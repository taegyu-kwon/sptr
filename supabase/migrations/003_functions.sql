-- SPTR 003: RPC (security definer, search_path 고정)
-- 오류는 예외 대신 json {ok:false, reason:'...'} 으로 돌려 앱이 한국어 문구를 고른다.
-- reason: 'unknown' 미등록 코드 | 'used' 사용됨 | 'revoked' 폐기 | 'expired' 만료 | 'archived' 보관된 선수
--         | 'taken' 그 선수의 본인/학부모 계정이 이미 있음 | 'has_profile' 이 로그인 사용자는 이미 프로필이 있음
--         | 'unauthenticated' 로그인 안 됨 | 'invalid' 인자 오류(빈 팀 이름 등)

-- 내부용: 코드 검사 공통. 잠금 여부만 다르다. API 에는 노출하지 않는다(실행 권한 없음).
create or replace function public._check_signup_code(p_code text, p_lock boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_code   text := upper(btrim(coalesce(p_code, '')));
  c        public.signup_codes%rowtype;
  pl       public.players%rowtype;
  v_rel    text;
  v_team   text;
  v_info   jsonb;
begin
  if p_lock then
    select * into c from public.signup_codes where code = v_code for update;
  else
    select * into c from public.signup_codes where code = v_code;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  select name into v_team from public.teams where id = c.team_id;
  v_rel := case when c.role = 'player' then coalesce(c.relation, 'self') else null end;
  if c.role = 'player' then
    select * into pl from public.players where id = c.player_id;
  end if;

  -- 실패해도 문구에 필요한 정보(선수 이름 · 만료일 등)는 같이 돌려준다
  v_info := jsonb_build_object(
    'code', c.code,
    'role', c.role,
    'relation', v_rel,
    'team_id', c.team_id,
    'team_name', v_team,
    'player_id', c.player_id,
    'player_name', coalesce(pl.name, c.player_name),
    'expires_at', c.expires_at);

  if c.used then
    return v_info || jsonb_build_object('ok', false, 'reason', 'used');
  elsif c.revoked then
    return v_info || jsonb_build_object('ok', false, 'reason', 'revoked');
  elsif c.expires_at is not null and public.kst_today() > c.expires_at then
    return v_info || jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if c.role = 'player' then
    if pl.id is null then
      return v_info || jsonb_build_object('ok', false, 'reason', 'unknown');
    elsif pl.archived is not null then
      return v_info || jsonb_build_object('ok', false, 'reason', 'archived');
    elsif exists (select 1 from public.profiles p
                   where p.player_id = pl.id and p.relation = v_rel) then
      return v_info || jsonb_build_object('ok', false, 'reason', 'taken');
    end if;
  end if;

  return v_info || jsonb_build_object('ok', true, 'reason', null);
end $$;

-- ───────────────────────── peek_signup_code ─────────────────────────
-- 가입 화면용. 로그인 전(anon)도 호출할 수 있다. 아무것도 바꾸지 않는다.
create or replace function public.peek_signup_code(p_code text)
returns json language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare r jsonb;
begin
  r := public._check_signup_code(p_code, false);
  -- 로그인 전 화면에 내부 id 는 내보내지 않는다
  return (r - 'team_id' - 'player_id' - 'code')::json;
end $$;

-- ───────────────────────── redeem_signup_code ─────────────────────────
-- 방금 auth.signUp 한(또는 프로필이 아직 없는) 로그인 사용자에게 코드로 프로필을 만든다.
-- 이름: 선수 본인 = 선수 이름(p_name 무시) / 학부모 = p_name, 비면 "<선수 이름> 학부모" / 코치 = p_name, 비면 "코치"
create or replace function public.redeem_signup_code(p_code text, p_name text)
returns json language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  r       jsonb;
  v_name  text := left(btrim(coalesce(p_name, '')), 40);
  v_email text;
  v_cons  text;
  prof    public.profiles%rowtype;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'reason', 'unauthenticated');
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    return json_build_object('ok', false, 'reason', 'has_profile');
  end if;

  r := public._check_signup_code(p_code, true);
  if not (r->>'ok')::boolean then
    return (r - 'team_id' - 'player_id' - 'code')::json;
  end if;

  if r->>'role' = 'player' then
    if r->>'relation' = 'parent' then
      v_name := coalesce(nullif(v_name, ''), left((r->>'player_name') || ' 학부모', 40));
    else
      v_name := r->>'player_name';
    end if;
  else
    v_name := coalesce(nullif(v_name, ''), '코치');
  end if;

  select coalesce(u.email, '') into v_email from auth.users u where u.id = v_uid;

  begin
    insert into public.profiles (id, email, name, role, relation, team_id, player_id)
    values (v_uid, coalesce(v_email, ''), v_name, r->>'role', r->>'relation', r->>'team_id', r->>'player_id')
    returning * into prof;
  exception when unique_violation then
    -- 동시에 두 번 눌렀거나(같은 사용자), 같은 선수의 계정이 방금 생긴 경우
    get stacked diagnostics v_cons = constraint_name;
    return json_build_object('ok', false,
      'reason', case when v_cons = 'profiles_pkey' then 'has_profile' else 'taken' end);
  end;

  update public.signup_codes set used = true where code = r->>'code';

  return json_build_object('ok', true, 'reason', null, 'profile', to_json(prof));
end $$;

-- ───────────────────────── create_team ─────────────────────────
-- 프로필이 없는 로그인 사용자가 새 팀을 만들고 그 팀의 코치가 된다.
-- TODO(확정 정책): 팀 생성은 관리자만. 관리자 화면이 생기면 app_admins 테이블을 두고
--   여기서 "auth.uid() 가 app_admins 에 있는가" 를 검사하도록 좁힌다. 지금은 "새 팀 시작" 버튼이 대신한다.
create or replace function public.create_team(p_name text, p_region text, p_coach_name text)
returns json language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_name   text := left(btrim(coalesce(p_name, '')), 60);
  v_region text := left(btrim(coalesce(p_region, '')), 60);
  v_coach  text := coalesce(nullif(left(btrim(coalesce(p_coach_name, '')), 40), ''), '코치');
  v_team   text;
  v_email  text;
  prof     public.profiles%rowtype;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'reason', 'unauthenticated');
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    return json_build_object('ok', false, 'reason', 'has_profile');
  end if;
  if v_name = '' then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;

  v_team := 't-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  select coalesce(u.email, '') into v_email from auth.users u where u.id = v_uid;

  begin
    insert into public.teams (id, name, region) values (v_team, v_name, v_region);
    insert into public.profiles (id, email, name, role, relation, team_id, player_id)
    values (v_uid, coalesce(v_email, ''), v_coach, 'coach', null, v_team, null)
    returning * into prof;
  exception when unique_violation then
    -- 동시에 두 번 눌렀다: 이 블록의 팀 insert 도 함께 되돌려진다
    return json_build_object('ok', false, 'reason', 'has_profile');
  end;

  return json_build_object('ok', true, 'reason', null, 'team_id', v_team,
    'team', json_build_object('id', v_team, 'name', v_name, 'region', v_region),
    'profile', to_json(prof));
end $$;

-- ───────────────────────── my_account ─────────────────────────
-- 로그인 직후 한 번 호출: 프로필 유무와 "보관된 선수 계정" 여부를 알려 준다
-- (보관 계정은 RLS 로 팀 데이터를 0행만 읽으므로, 앱이 이유를 알 방법이 따로 필요하다).
create or replace function public.my_account()
returns json language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  prof  public.profiles%rowtype;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'reason', 'unauthenticated');
  end if;
  select * into prof from public.profiles where id = v_uid;
  if not found then
    return json_build_object('ok', true, 'reason', null, 'profile', null, 'archived', false);
  end if;
  return json_build_object('ok', true, 'reason', null, 'profile', to_json(prof),
    'archived', exists (select 1 from public.players pl
                         where pl.id = prof.player_id and pl.archived is not null));
end $$;

-- ───────────────────────── 실행 권한 ─────────────────────────
revoke all on function public._check_signup_code(text, boolean) from public, anon, authenticated;
revoke all on function public.peek_signup_code(text) from public;
revoke all on function public.redeem_signup_code(text, text) from public, anon;
revoke all on function public.create_team(text, text, text) from public, anon;
revoke all on function public.my_account() from public, anon;

grant execute on function public.peek_signup_code(text) to anon, authenticated;
grant execute on function public.redeem_signup_code(text, text) to authenticated;
grant execute on function public.create_team(text, text, text) to authenticated;
grant execute on function public.my_account() to authenticated;
