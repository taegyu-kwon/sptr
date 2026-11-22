-- SPTR 002: 도우미 함수 · 권한(grant) · RLS 정책 · 트리거
-- 여러 번 실행해도 된다(create or replace, drop ... if exists).
-- 원칙: 읽기 = 같은 팀, 쓰기 = 같은 팀 코치. 예외는 아래 각 테이블 주석 참고.

-- ───────────────────────── 도우미 함수 ─────────────────────────
-- security definer: profiles 의 RLS 정책이 다시 profiles 를 읽어 재귀하지 않게 한다.

-- 내 팀. 프로필이 없거나, 연결된 선수가 보관(archived)된 계정이면 null → 아무것도 못 읽는다.
create or replace function public.my_team()
returns text language sql stable security definer set search_path = public, pg_temp
as $$
  select p.team_id
    from public.profiles p
   where p.id = auth.uid()
     and not exists (select 1 from public.players pl
                      where pl.id = p.player_id and pl.archived is not null)
$$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public, pg_temp
as $$ select p.role from public.profiles p where p.id = auth.uid() $$;

create or replace function public.my_player()
returns text language sql stable security definer set search_path = public, pg_temp
as $$ select p.player_id from public.profiles p where p.id = auth.uid() $$;

create or replace function public.is_coach()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce((select p.role = 'coach' from public.profiles p where p.id = auth.uid()), false) $$;

-- 선수 본인 계정(학부모 아님)
create or replace function public.is_self_player()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce((select p.role = 'player' and p.relation is distinct from 'parent'
                     from public.profiles p where p.id = auth.uid()), false)
$$;

-- 한국 날짜의 오늘(코드 만료 · 선수 출석 체크 날짜 검사에 쓴다)
create or replace function public.kst_today()
returns date language sql stable set search_path = public, pg_temp
as $$ select (now() at time zone 'Asia/Seoul')::date $$;

revoke all on function public.my_team(), public.my_role(), public.my_player(),
  public.is_coach(), public.is_self_player(), public.kst_today() from public, anon;
grant execute on function public.my_team(), public.my_role(), public.my_player(),
  public.is_coach(), public.is_self_player(), public.kst_today() to authenticated;

-- ───────────────────────── 테이블 권한 ─────────────────────────
-- anon 에게는 테이블 권한을 주지 않는다(Supabase 기본 권한도 걷어 낸다). 로그인 전에는 peek_signup_code RPC 만 쓴다.
revoke all on table
  public.teams, public.profiles, public.players, public.measurements, public.feedbacks,
  public.games, public.lineups, public.signup_codes, public.attendance, public.notices,
  public.notice_reads, public.scheduled_games, public.tournaments, public.directions
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.players, public.measurements, public.feedbacks, public.games, public.lineups,
  public.signup_codes, public.attendance, public.notices, public.notice_reads,
  public.scheduled_games, public.tournaments, public.directions
to authenticated;

-- teams: 만들기는 create_team RPC 로만. 지우기는 앱에서 하지 않는다.
grant select on table public.teams to authenticated;
grant update (name, region) on table public.teams to authenticated;
-- profiles: 만들기는 RPC 로만. 본인이 name 칼럼만 고칠 수 있다.
grant select on table public.profiles to authenticated;
grant update (name) on table public.profiles to authenticated;

-- ───────────────────────── RLS 켜기 ─────────────────────────
alter table public.teams           enable row level security;
alter table public.profiles        enable row level security;
alter table public.players         enable row level security;
alter table public.measurements    enable row level security;
alter table public.feedbacks       enable row level security;
alter table public.games           enable row level security;
alter table public.lineups         enable row level security;
alter table public.signup_codes    enable row level security;
alter table public.attendance      enable row level security;
alter table public.notices         enable row level security;
alter table public.notice_reads    enable row level security;
alter table public.scheduled_games enable row level security;
alter table public.tournaments     enable row level security;
alter table public.directions      enable row level security;

-- ───────────────────────── 공통: 같은 팀 읽기 / 같은 팀 코치 쓰기 ─────────────────────────
-- (select fn()) 로 감싸 문장당 한 번만 계산되게 한다.
do $$
declare t text;
begin
  -- 읽기: 같은 팀이면 전부
  foreach t in array array['players','measurements','games','attendance','notices',
                           'scheduled_games','tournaments','directions'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_team', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (team_id = (select public.my_team()))', t || '_select_team', t);
  end loop;

  -- 쓰기: 같은 팀 코치
  foreach t in array array['players','measurements','feedbacks','games','lineups','signup_codes',
                           'attendance','notices','scheduled_games','tournaments','directions'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert_coach', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_coach', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_coach', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check ((select public.is_coach()) and team_id = (select public.my_team()))',
      t || '_insert_coach', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using ((select public.is_coach()) and team_id = (select public.my_team()))
         with check ((select public.is_coach()) and team_id = (select public.my_team()))',
      t || '_update_coach', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using ((select public.is_coach()) and team_id = (select public.my_team()))',
      t || '_delete_coach', t);
  end loop;
end $$;

-- ───────────────────────── teams ─────────────────────────
drop policy if exists teams_select_own on public.teams;
create policy teams_select_own on public.teams for select to authenticated
  using (id = (select public.my_team()));

drop policy if exists teams_update_coach on public.teams;
create policy teams_update_coach on public.teams for update to authenticated
  using ((select public.is_coach()) and id = (select public.my_team()))
  with check ((select public.is_coach()) and id = (select public.my_team()));

-- ───────────────────────── profiles ─────────────────────────
-- 읽기: 본인 행(보관된 선수 계정도 자기 행은 읽는다) + 코치는 같은 팀 전원
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid())
         or ((select public.is_coach()) and team_id = (select public.my_team())));

-- 수정: 본인 행만(칼럼 권한 + 아래 트리거로 name 만)
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ───────────────────────── feedbacks ─────────────────────────
-- 읽기: 코치는 팀 전부. 선수·학부모는 팀 전체 피드백(player_id null) + 자기(자녀) 피드백만.
drop policy if exists feedbacks_select_team on public.feedbacks;
create policy feedbacks_select_team on public.feedbacks for select to authenticated
  using (team_id = (select public.my_team())
         and ((select public.is_coach())
              or player_id is null
              or player_id = (select public.my_player())));

-- ───────────────────────── lineups ─────────────────────────
-- 읽기: 코치는 전부. 선수·학부모는 공개(published)된 것만.
drop policy if exists lineups_select_team on public.lineups;
create policy lineups_select_team on public.lineups for select to authenticated
  using (team_id = (select public.my_team())
         and ((select public.is_coach()) or published));

-- ───────────────────────── signup_codes ─────────────────────────
-- 읽기: 코치만(쓰기는 위 공통 정책). 가입 화면은 peek_signup_code RPC 를 쓴다.
drop policy if exists signup_codes_select_coach on public.signup_codes;
create policy signup_codes_select_coach on public.signup_codes for select to authenticated
  using ((select public.is_coach()) and team_id = (select public.my_team()));

-- ───────────────────────── attendance: 선수 본인 예외 ─────────────────────────
-- 선수 본인(학부모 제외)이 자기 행을 insert/update. source 는 '선수', 날짜는 한국 오늘 ±1일
-- (기기 시계·시간대 차이 여유. "오늘만" 은 앱이 검사한다). 삭제는 코치만.
drop policy if exists attendance_insert_self on public.attendance;
create policy attendance_insert_self on public.attendance for insert to authenticated
  with check ((select public.is_self_player())
              and team_id = (select public.my_team())
              and player_id = (select public.my_player())
              and source = '선수'
              and date between (select public.kst_today()) - 1 and (select public.kst_today()) + 1);

drop policy if exists attendance_update_self on public.attendance;
create policy attendance_update_self on public.attendance for update to authenticated
  using ((select public.is_self_player())
         and team_id = (select public.my_team())
         and player_id = (select public.my_player())
         and date between (select public.kst_today()) - 1 and (select public.kst_today()) + 1)
  with check ((select public.is_self_player())
              and team_id = (select public.my_team())
              and player_id = (select public.my_player())
              and source = '선수'
              and date between (select public.kst_today()) - 1 and (select public.kst_today()) + 1);

-- ───────────────────────── notice_reads ─────────────────────────
-- team_id 칼럼이 없어 공지(notices)를 거쳐 팀을 확인한다.
drop policy if exists notice_reads_select_team on public.notice_reads;
create policy notice_reads_select_team on public.notice_reads for select to authenticated
  using (exists (select 1 from public.notices n
                  where n.id = notice_id and n.team_id = (select public.my_team())));

drop policy if exists notice_reads_insert_coach on public.notice_reads;
create policy notice_reads_insert_coach on public.notice_reads for insert to authenticated
  with check ((select public.is_coach())
              and exists (select 1 from public.notices n
                           where n.id = notice_id and n.team_id = (select public.my_team())));

drop policy if exists notice_reads_update_coach on public.notice_reads;
create policy notice_reads_update_coach on public.notice_reads for update to authenticated
  using ((select public.is_coach())
         and exists (select 1 from public.notices n
                      where n.id = notice_id and n.team_id = (select public.my_team())))
  with check ((select public.is_coach())
              and exists (select 1 from public.notices n
                           where n.id = notice_id and n.team_id = (select public.my_team())));

drop policy if exists notice_reads_delete_coach on public.notice_reads;
create policy notice_reads_delete_coach on public.notice_reads for delete to authenticated
  using ((select public.is_coach())
         and exists (select 1 from public.notices n
                      where n.id = notice_id and n.team_id = (select public.my_team())));

-- 선수 본인이 자기 읽음 표시를 upsert
drop policy if exists notice_reads_insert_self on public.notice_reads;
create policy notice_reads_insert_self on public.notice_reads for insert to authenticated
  with check ((select public.is_self_player())
              and player_id = (select public.my_player())
              and exists (select 1 from public.notices n
                           where n.id = notice_id and n.team_id = (select public.my_team())));

drop policy if exists notice_reads_update_self on public.notice_reads;
create policy notice_reads_update_self on public.notice_reads for update to authenticated
  using ((select public.is_self_player())
         and player_id = (select public.my_player())
         and exists (select 1 from public.notices n
                      where n.id = notice_id and n.team_id = (select public.my_team())))
  with check ((select public.is_self_player())
              and player_id = (select public.my_player())
              and exists (select 1 from public.notices n
                           where n.id = notice_id and n.team_id = (select public.my_team())));

-- ───────────────────────── 트리거: profiles 수정 제한 ─────────────────────────
-- API(authenticated/anon 역할)로 들어온 수정은 name 만, 그것도 코치·학부모 계정만.
-- 선수 본인 계정의 이름은 코치가 players.name 을 고치면 아래 동기화 트리거가 맞춘다.
-- security definer 함수(RPC · 동기화 트리거)와 관리자(SQL Editor)는 current_user 가 달라 통과한다.
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.relation is distinct from old.relation
     or new.team_id is distinct from old.team_id
     or new.player_id is distinct from old.player_id
     or new.created_at is distinct from old.created_at then
    raise exception 'profiles: name 만 수정할 수 있습니다' using errcode = '42501';
  end if;
  if new.name is distinct from old.name
     and old.role = 'player' and old.relation is distinct from 'parent' then
    raise exception 'profiles: 선수 이름은 코치가 선수단 화면에서 수정합니다' using errcode = '42501';
  end if;
  new.name := btrim(new.name);
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- ───────────────────────── 트리거: 선수 이름 변경 동기화 ─────────────────────────
-- 코치가 players.name 을 바꾸면 그 선수의 본인 계정 이름과 가입 코드의 player_name 을 맞춘다
-- (store.updatePlayer 가 로컬에서 하던 일. 코치는 남의 profiles 를 직접 고칠 수 없어 서버가 한다).
create or replace function public.players_sync_name()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.profiles set name = new.name
   where player_id = new.id and relation is distinct from 'parent';
  update public.signup_codes set player_name = new.name
   where player_id = new.id;
  return null;
end $$;

drop trigger if exists players_sync_name on public.players;
create trigger players_sync_name after update of name on public.players
  for each row when (new.name is distinct from old.name)
  execute function public.players_sync_name();

revoke all on function public.profiles_guard(), public.players_sync_name() from public, anon, authenticated;
