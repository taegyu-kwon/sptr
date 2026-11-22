-- SPTR RLS · RPC 검사. 001~003 을 적용한 DB 에서 관리자(postgres / SQL Editor)로 실행한다.
-- 한 트랜잭션 안에서 가짜 사용자·팀·선수·코드를 넣고 역할을 바꿔 가며 기대 결과를 확인한 뒤,
-- 마지막에 rollback 해서 아무것도 남기지 않는다. 실패하면 "RLS CHECK FAILED [검사 이름]" 예외가 난다.
-- 끝까지 통과하면 "ALL RLS CHECKS PASSED" 알림이 나온다.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_check.sql
--
-- 가짜 사용자 (uuid 끝자리)
--   …a1 코치 A팀   …a2 선수 본인 A팀(pA1)   …a3 학부모 A팀(pA1)   …b1 코치 B팀
--   …a4 보관된 선수(pA3)의 본인 계정   …c1 …c2 …c3 프로필 없는 새 가입자(redeem · create_team 용)

begin;

-- ───────────────────────── 검사 도우미(rollback 으로 함께 사라진다) ─────────────────────────
-- 실행해서 영향받은(또는 읽힌) 행 수
create function public._t_rows(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

create function public._t_eq(p_label text, p_got anyelement, p_want anyelement) returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then
    raise exception 'RLS CHECK FAILED [%]: got %, want %', p_label, p_got, p_want;
  end if;
end $$;

-- 주어진 SQLSTATE 로 실패해야 한다(기본 42501 = RLS 위반 · 권한 없음)
create function public._t_fails(p_label text, p_sql text, p_state text default '42501') returns void language plpgsql as $$
declare v_state text := null;
begin
  begin
    execute p_sql;
  exception when others then
    v_state := sqlstate;
  end;
  if v_state is null then
    raise exception 'RLS CHECK FAILED [%]: 거부되어야 하는데 성공함', p_label;
  elsif v_state <> p_state then
    raise exception 'RLS CHECK FAILED [%]: SQLSTATE % (기대 %)', p_label, v_state, p_state;
  end if;
end $$;

grant execute on function public._t_rows(text), public._t_eq(text, anyelement, anyelement),
  public._t_fails(text, text, text) to anon, authenticated;

-- ───────────────────────── 준비(관리자) ─────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-4000-a000-0000000000a1', 'rlschk-coach-a@example.test'),
  ('00000000-0000-4000-a000-0000000000a2', 'rlschk-player-a@example.test'),
  ('00000000-0000-4000-a000-0000000000a3', 'rlschk-parent-a@example.test'),
  ('00000000-0000-4000-a000-0000000000a4', 'rlschk-archived-a@example.test'),
  ('00000000-0000-4000-a000-0000000000b1', 'rlschk-coach-b@example.test'),
  ('00000000-0000-4000-a000-0000000000c1', 'rlschk-new1@example.test'),
  ('00000000-0000-4000-a000-0000000000c2', 'rlschk-new2@example.test'),
  ('00000000-0000-4000-a000-0000000000c3', 'rlschk-new3@example.test');

insert into public.teams (id, name, region) values
  ('rlschk-tA', '검사A중학교', '서울'), ('rlschk-tB', '검사B중학교', '부산');

insert into public.players (id, team_id, name, position, position_detail, throws, bats, back_number, grade, archived) values
  ('rlschk-pA1', 'rlschk-tA', '가나다', '투수',   '투수',   '우', '우', 1, 3, null),
  ('rlschk-pA2', 'rlschk-tA', '라마바', '내야수', '유격수', '우', '좌', 6, 2, null),
  ('rlschk-pA3', 'rlschk-tA', '사아자', '외야수', '중견수', '좌', '좌', 8, 3, '{"reason":"졸업","at":"2026-02-10"}'),
  ('rlschk-pB1', 'rlschk-tB', '차카타', '포수',   '포수',   '우', '우', 2, 1, null);

insert into public.profiles (id, email, name, role, relation, team_id, player_id) values
  ('00000000-0000-4000-a000-0000000000a1', 'rlschk-coach-a@example.test',    '코치A',        'coach',  null,     'rlschk-tA', null),
  ('00000000-0000-4000-a000-0000000000a2', 'rlschk-player-a@example.test',   '가나다',       'player', 'self',   'rlschk-tA', 'rlschk-pA1'),
  ('00000000-0000-4000-a000-0000000000a3', 'rlschk-parent-a@example.test',   '가나다 학부모', 'player', 'parent', 'rlschk-tA', 'rlschk-pA1'),
  ('00000000-0000-4000-a000-0000000000a4', 'rlschk-archived-a@example.test', '사아자',       'player', 'self',   'rlschk-tA', 'rlschk-pA3'),
  ('00000000-0000-4000-a000-0000000000b1', 'rlschk-coach-b@example.test',    '코치B',        'coach',  null,     'rlschk-tB', null);

insert into public.signup_codes (code, team_id, role, relation, player_id, player_name, used, issued_at, expires_at, revoked) values
  ('RLSCHK-COACH',   'rlschk-tA', 'coach',  null,     null,         null,     false, public.kst_today(),      public.kst_today() + 14, false),
  ('RLSCHK-SELF2',   'rlschk-tA', 'player', 'self',   'rlschk-pA2', '라마바', false, public.kst_today(),      public.kst_today() + 14, false),
  ('RLSCHK-PARENT2', 'rlschk-tA', 'player', 'parent', 'rlschk-pA2', '라마바', false, public.kst_today(),      public.kst_today(),      false),
  ('RLSCHK-USED',    'rlschk-tA', 'player', 'self',   'rlschk-pA2', '라마바', true,  public.kst_today(),      public.kst_today() + 14, false),
  ('RLSCHK-REVOKED', 'rlschk-tA', 'player', 'self',   'rlschk-pA2', '라마바', false, public.kst_today(),      public.kst_today() + 14, true),
  ('RLSCHK-EXPIRED', 'rlschk-tA', 'player', 'self',   'rlschk-pA2', '라마바', false, public.kst_today() - 20, public.kst_today() - 1,  false),
  ('RLSCHK-ARCH',    'rlschk-tA', 'player', 'parent', 'rlschk-pA3', '사아자', false, public.kst_today(),      public.kst_today() + 14, false),
  ('RLSCHK-TAKEN',   'rlschk-tA', 'player', 'self',   'rlschk-pA1', '가나다', false, public.kst_today(),      public.kst_today() + 14, false),
  ('RLSCHK-B',       'rlschk-tB', 'coach',  null,     null,         null,     false, public.kst_today(),      null,                    false);

insert into public.measurements (player_id, team_id, date, body, athletic, practical) values
  ('rlschk-pA1', 'rlschk-tA', '2026-10-01', '{"age":15}', '{"squat":80}', '{"kind":"투수","maxVelo":120}'),
  ('rlschk-pB1', 'rlschk-tB', '2026-10-01', '{"age":13}', '{"squat":50}', '{"kind":"야수","maxVelo":90}');
insert into public.feedbacks (id, team_id, player_id, author, date, category, content) values
  ('rlschk-f1', 'rlschk-tA', 'rlschk-pA1', '코치A', '2026-11-01', '투구', 'pA1 개인'),
  ('rlschk-f2', 'rlschk-tA', 'rlschk-pA2', '코치A', '2026-11-01', '타격', 'pA2 개인'),
  ('rlschk-f3', 'rlschk-tA', null,         '코치A', '2026-11-01', '팀 전체', '팀 전체'),
  ('rlschk-f4', 'rlschk-tB', null,         '코치B', '2026-11-01', '팀 전체', 'B팀');
insert into public.scheduled_games (id, team_id, date, time, kind, opponent, place) values
  ('rlschk-sgA', 'rlschk-tA', '2026-12-01', '10:00', '연습경기', '상대', '운동장'),
  ('rlschk-sgB', 'rlschk-tB', '2026-12-01', '10:00', '정식대회', '상대', '운동장');
insert into public.tournaments (id, team_id, name, start_date, end_date, place) values
  ('rlschk-tnA', 'rlschk-tA', '대회A', '2026-12-01', '2026-12-05', '목동'),
  ('rlschk-tnB', 'rlschk-tB', '대회B', '2026-12-01', '2026-12-05', '사직');
insert into public.games (id, team_id, date, type, opponent, score_for, score_against, result) values
  ('rlschk-gA', 'rlschk-tA', '2026-11-01', '정식', '상대', 3, 1, '승'),
  ('rlschk-gB', 'rlschk-tB', '2026-11-01', '연습', '상대', 1, 1, '무');
insert into public.lineups (id, team_id, game_id, published, "order") values
  ('rlschk-luA0', 'rlschk-tA', null,         true,  '[{"playerId":"rlschk-pA1","pos":"투수"},null]'),
  ('rlschk-luA1', 'rlschk-tA', 'rlschk-sgA', false, '[]'),
  ('rlschk-luB0', 'rlschk-tB', null,         true,  '[]');
insert into public.attendance (id, team_id, player_id, date, status, source) values
  ('rlschk-atA2', 'rlschk-tA', 'rlschk-pA2', public.kst_today(), '출석', '코치'),
  ('rlschk-atB1', 'rlschk-tB', 'rlschk-pB1', public.kst_today(), '출석', '코치');
insert into public.notices (id, team_id, date, items, author) values
  ('rlschk-ntA', 'rlschk-tA', public.kst_today(), '[{"id":"ni1","start":"16:00","end":"17:30","group":"전체","title":"수비"}]', '코치A'),
  ('rlschk-ntB', 'rlschk-tB', public.kst_today(), '[]', '코치B');
insert into public.notice_reads (notice_id, player_id) values
  ('rlschk-ntA', 'rlschk-pA2'), ('rlschk-ntB', 'rlschk-pB1');
insert into public.directions (team_id, month, theme, items) values
  ('rlschk-tA', '2026-11', '수비', '[]'), ('rlschk-tB', '2026-11', '타격', '[]');

-- ═════════════════════════ 1. 코치 A ═════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a1","role":"authenticated"}';
do $$
begin
  perform public._t_eq('코치A: my_team', public.my_team(), 'rlschk-tA');
  perform public._t_eq('코치A: is_coach', public.is_coach(), true);
  perform public._t_eq('코치A: 팀 1개만 보임', (select count(*) from public.teams), 1::bigint);
  perform public._t_eq('코치A: 선수 3명(보관 포함)', (select count(*) from public.players), 3::bigint);
  perform public._t_eq('코치A: B팀 선수 0행', (select count(*) from public.players where team_id = 'rlschk-tB'), 0::bigint);
  perform public._t_eq('코치A: 팀 프로필 4개', (select count(*) from public.profiles), 4::bigint);
  perform public._t_eq('코치A: A팀 코드 8개', (select count(*) from public.signup_codes), 8::bigint);
  perform public._t_eq('코치A: 피드백 3개', (select count(*) from public.feedbacks), 3::bigint);
  perform public._t_eq('코치A: 라인업 2개(미공개 포함)', (select count(*) from public.lineups), 2::bigint);

  -- 쓰기: 자기 팀은 되고 다른 팀은 안 된다
  perform public._t_eq('코치A: 선수 등록', public._t_rows(
    $q$insert into public.players (id, team_id, name, position, back_number, grade) values ('rlschk-pA9','rlschk-tA','새선수','투수',99,1)$q$), 1::bigint);
  perform public._t_eq('코치A: 선수 upsert(on conflict id)', public._t_rows(
    $q$insert into public.players (id, team_id, name, position, back_number, grade) values ('rlschk-pA9','rlschk-tA','새선수','투수',98,1)
       on conflict (id) do update set back_number = excluded.back_number$q$), 1::bigint);
  perform public._t_eq('코치A: 선수 삭제', public._t_rows($q$delete from public.players where id = 'rlschk-pA9'$q$), 1::bigint);
  perform public._t_fails('코치A: B팀에 선수 등록 거부',
    $q$insert into public.players (id, team_id, name, position, back_number, grade) values ('rlschk-pX','rlschk-tB','침입','투수',1,1)$q$);
  perform public._t_eq('코치A: B팀 선수 수정 0행', public._t_rows($q$update public.players set name = '침입' where id = 'rlschk-pB1'$q$), 0::bigint);
  perform public._t_eq('코치A: B팀 선수 삭제 0행', public._t_rows($q$delete from public.players where id = 'rlschk-pB1'$q$), 0::bigint);
  perform public._t_fails('코치A: 자기 선수를 B팀으로 옮기기 거부', $q$update public.players set team_id = 'rlschk-tB' where id = 'rlschk-pA2'$q$);
  perform public._t_fails('코치A: B팀 선수 id 로 출석 넣기 거부(FK)',
    format($q$insert into public.attendance (id, team_id, player_id, date, status, source) values ('rlschk-x','rlschk-tA','rlschk-pB1',%L,'출석','코치')$q$, public.kst_today() + 5), '23503');
  perform public._t_eq('코치A: 출석 upsert(on conflict player_id,date)', public._t_rows(
    format($q$insert into public.attendance (id, team_id, player_id, date, status, source) values ('rlschk-atA2','rlschk-tA','rlschk-pA2',%L,'지각','코치')
              on conflict (player_id, date) do update set status = excluded.status$q$, public.kst_today())), 1::bigint);
  perform public._t_eq('코치A: 지난 날짜 출석 입력', public._t_rows(
    $q$insert into public.attendance (id, team_id, player_id, date, status, source) values ('rlschk-atOld','rlschk-tA','rlschk-pA1','2026-01-05','결석','코치')$q$), 1::bigint);
  perform public._t_eq('코치A: 측정 upsert', public._t_rows(
    $q$insert into public.measurements (player_id, team_id, date, body, athletic, practical) values ('rlschk-pA1','rlschk-tA','2026-10-01','{"age":15}','{"squat":85}','{"kind":"투수"}')
       on conflict (player_id, date) do update set athletic = excluded.athletic$q$), 1::bigint);
  perform public._t_eq('코치A: 팀 이름 수정', public._t_rows($q$update public.teams set name = '검사A중' where id = 'rlschk-tA'$q$), 1::bigint);
  perform public._t_eq('코치A: B팀 이름 수정 0행', public._t_rows($q$update public.teams set name = '침입' where id = 'rlschk-tB'$q$), 0::bigint);
  perform public._t_fails('코치A: 팀 직접 만들기 거부', $q$insert into public.teams (id, name) values ('rlschk-tX','침입')$q$);
  perform public._t_fails('코치A: 프로필 직접 만들기 거부',
    $q$insert into public.profiles (id, name, role, team_id) values ('00000000-0000-4000-a000-0000000000c1','침입','coach','rlschk-tA')$q$);
  perform public._t_eq('코치A: 남의 프로필 수정 0행', public._t_rows($q$update public.profiles set name = '침입' where id = '00000000-0000-4000-a000-0000000000a3'$q$), 0::bigint);
  perform public._t_eq('코치A: 자기 이름 수정', public._t_rows($q$update public.profiles set name = '  코치에이 ' where id = '00000000-0000-4000-a000-0000000000a1'$q$), 1::bigint);
  perform public._t_eq('코치A: 이름 trim', (select name from public.profiles where id = '00000000-0000-4000-a000-0000000000a1'), '코치에이');
  perform public._t_eq('코치A: 코드 발급', public._t_rows(
    format($q$insert into public.signup_codes (code, team_id, role, relation, player_id, player_name, issued_at, expires_at) values ('RLSCHK-NEW','rlschk-tA','player','parent','rlschk-pA1','가나다',%L,%L)$q$, public.kst_today(), public.kst_today() + 14)), 1::bigint);
  perform public._t_eq('코치A: 코드 폐기', public._t_rows($q$update public.signup_codes set revoked = true where code = 'RLSCHK-NEW'$q$), 1::bigint);
  perform public._t_fails('코치A: B팀 코드 발급 거부', $q$insert into public.signup_codes (code, team_id, role) values ('RLSCHK-X','rlschk-tB','coach')$q$);

  -- 선수 이름을 바꾸면 본인 계정 이름 · 코드의 player_name 이 따라온다(학부모 계정 이름은 그대로)
  perform public._t_eq('코치A: 선수 이름 수정', public._t_rows($q$update public.players set name = '가나다라' where id = 'rlschk-pA1'$q$), 1::bigint);
  perform public._t_eq('이름 동기화: 본인 계정', (select name from public.profiles where id = '00000000-0000-4000-a000-0000000000a2'), '가나다라');
  perform public._t_eq('이름 동기화: 학부모 계정은 그대로', (select name from public.profiles where id = '00000000-0000-4000-a000-0000000000a3'), '가나다 학부모');
  perform public._t_eq('이름 동기화: 코드', (select player_name from public.signup_codes where code = 'RLSCHK-TAKEN'), '가나다라');

  perform public._t_eq('코치A: create_team → has_profile', public.create_team('또다른팀', '서울', '코치')->>'reason', 'has_profile');
  perform public._t_eq('코치A: redeem → has_profile', public.redeem_signup_code('RLSCHK-COACH', '코치')->>'reason', 'has_profile');
end $$;
reset role;

-- ═════════════════════════ 2. 코치 B: A팀 것은 아무것도 안 보인다 ═════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b1","role":"authenticated"}';
do $$
declare t text;
begin
  foreach t in array array['players','measurements','feedbacks','games','lineups','signup_codes','attendance',
                           'notices','scheduled_games','tournaments','directions','profiles'] loop
    perform public._t_eq('코치B: A팀 ' || t || ' 0행',
      public._t_rows(format('select 1 from public.%I where team_id = %L', t, 'rlschk-tA')), 0::bigint);
    if public._t_rows(format('select 1 from public.%I', t)) = 0 then
      raise exception 'RLS CHECK FAILED [코치B: 자기 팀 % 은 보여야 함]', t;
    end if;
  end loop;
  perform public._t_eq('코치B: A팀 teams 0행', (select count(*) from public.teams where id = 'rlschk-tA'), 0::bigint);
  perform public._t_eq('코치B: A팀 notice_reads 0행', (select count(*) from public.notice_reads where notice_id = 'rlschk-ntA'), 0::bigint);
  perform public._t_eq('코치B: 자기 팀 notice_reads 1행', (select count(*) from public.notice_reads), 1::bigint);
  perform public._t_fails('코치B: A팀 공지에 읽음 넣기 거부',
    $q$insert into public.notice_reads (notice_id, player_id) values ('rlschk-ntA','rlschk-pB1')$q$);
  perform public._t_eq('코치B: A팀 출석 삭제 0행', public._t_rows($q$delete from public.attendance where team_id = 'rlschk-tA'$q$), 0::bigint);
  perform public._t_eq('코치B: A팀 코드 폐기 0행', public._t_rows($q$update public.signup_codes set revoked = true where team_id = 'rlschk-tA'$q$), 0::bigint);
end $$;
reset role;

-- ═════════════════════════ 3. 선수 본인(A팀 pA1) ═════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
do $$
declare today date := public.kst_today();
begin
  perform public._t_eq('선수: is_self_player', public.is_self_player(), true);
  perform public._t_eq('선수: 활동·보관 선수 읽기 3명', (select count(*) from public.players), 3::bigint);
  perform public._t_eq('선수: B팀 선수 0행', (select count(*) from public.players where team_id = 'rlschk-tB'), 0::bigint);
  perform public._t_eq('선수: signup_codes 0행', (select count(*) from public.signup_codes), 0::bigint);
  perform public._t_eq('선수: 프로필은 본인 것만', (select count(*) from public.profiles), 1::bigint);
  perform public._t_eq('선수: 피드백은 내 것 + 팀 전체', (select count(*) from public.feedbacks), 2::bigint);
  perform public._t_eq('선수: 남의 개인 피드백 0행', (select count(*) from public.feedbacks where player_id = 'rlschk-pA2'), 0::bigint);
  perform public._t_eq('선수: 라인업은 공개된 것만', (select count(*) from public.lineups), 1::bigint);
  perform public._t_eq('선수: 팀 측정 기록 읽기', (select count(*) from public.measurements), 1::bigint);

  -- players 쓰기 거부
  perform public._t_fails('선수: players insert 거부',
    $q$insert into public.players (id, team_id, name, position, back_number, grade) values ('rlschk-pX','rlschk-tA','침입','투수',77,1)$q$);
  perform public._t_eq('선수: players update 0행', public._t_rows($q$update public.players set back_number = 77 where id = 'rlschk-pA1'$q$), 0::bigint);
  perform public._t_eq('선수: players delete 0행', public._t_rows($q$delete from public.players where id = 'rlschk-pA1'$q$), 0::bigint);
  perform public._t_fails('선수: 측정 기록 insert 거부',
    $q$insert into public.measurements (player_id, team_id, date, body, athletic, practical) values ('rlschk-pA1','rlschk-tA','2026-11-01','{}','{}','{"kind":"투수"}')$q$);
  perform public._t_fails('선수: 공지 insert 거부', $q$insert into public.notices (id, team_id, date) values ('rlschk-ntX','rlschk-tA','2026-12-25')$q$);
  perform public._t_fails('선수: 코드 발급 거부', $q$insert into public.signup_codes (code, team_id, role) values ('RLSCHK-X','rlschk-tA','coach')$q$);
  perform public._t_eq('선수: 팀 이름 수정 0행', public._t_rows($q$update public.teams set name = '침입'$q$), 0::bigint);

  -- 출석: 본인 것은 insert · upsert 성공
  perform public._t_eq('선수: 본인 출석 insert', public._t_rows(
    format($q$insert into public.attendance (id, team_id, player_id, date, status, checked_at, source) values (%L,'rlschk-tA','rlschk-pA1',%L,'출석',now(),'선수')$q$,
           'at-' || today || '-rlschk-pA1', today)), 1::bigint);
  perform public._t_eq('선수: 본인 출석 upsert', public._t_rows(
    format($q$insert into public.attendance (id, team_id, player_id, date, status, note, checked_at, source) values (%L,'rlschk-tA','rlschk-pA1',%L,'지각','버스',now(),'선수')
              on conflict (player_id, date) do update set status = excluded.status, note = excluded.note, checked_at = excluded.checked_at, source = excluded.source$q$,
           'at-' || today || '-rlschk-pA1', today)), 1::bigint);
  perform public._t_eq('선수: upsert 결과', (select status from public.attendance where player_id = 'rlschk-pA1' and date = today), '지각');
  -- 남의 출석 · 코치 표시 · 지난 날짜 · 삭제는 거부
  perform public._t_fails('선수: 남의 출석 insert 거부',
    format($q$insert into public.attendance (id, team_id, player_id, date, status, source) values ('rlschk-x2','rlschk-tA','rlschk-pA3',%L,'출석','선수')$q$, today));
  perform public._t_eq('선수: 남의 출석 update 0행', public._t_rows($q$update public.attendance set status = '결석' where player_id = 'rlschk-pA2'$q$), 0::bigint);
  perform public._t_fails('선수: 남의 출석 upsert 거부',
    format($q$insert into public.attendance (id, team_id, player_id, date, status, source) values ('rlschk-atA2','rlschk-tA','rlschk-pA2',%L,'결석','선수')
              on conflict (player_id, date) do update set status = excluded.status$q$, today));
  perform public._t_fails('선수: source=코치 로 쓰기 거부',
    format($q$update public.attendance set source = '코치' where player_id = 'rlschk-pA1' and date = %L$q$, today));
  perform public._t_fails('선수: 지난 날짜 출석 insert 거부',
    $q$insert into public.attendance (id, team_id, player_id, date, status, source) values ('rlschk-x3','rlschk-tA','rlschk-pA1','2026-01-06','출석','선수')$q$);
  perform public._t_eq('선수: 지난 날짜 본인 출석 update 0행', public._t_rows($q$update public.attendance set status = '출석' where id = 'rlschk-atOld'$q$), 0::bigint);
  perform public._t_eq('선수: 출석 delete 0행', public._t_rows($q$delete from public.attendance where player_id = 'rlschk-pA1'$q$), 0::bigint);

  -- 공지 읽음: 본인 것만 upsert
  perform public._t_eq('선수: 읽음 표시 insert', public._t_rows(
    $q$insert into public.notice_reads (notice_id, player_id, at) values ('rlschk-ntA','rlschk-pA1',now())$q$), 1::bigint);
  perform public._t_eq('선수: 읽음 표시 upsert', public._t_rows(
    $q$insert into public.notice_reads (notice_id, player_id, at) values ('rlschk-ntA','rlschk-pA1',now())
       on conflict (notice_id, player_id) do update set at = excluded.at$q$), 1::bigint);
  perform public._t_fails('선수: 남의 읽음 표시 거부',
    $q$insert into public.notice_reads (notice_id, player_id) values ('rlschk-ntA','rlschk-pA3')$q$);
  perform public._t_fails('선수: B팀 공지 읽음 표시 거부',
    $q$insert into public.notice_reads (notice_id, player_id) values ('rlschk-ntB','rlschk-pA1')$q$);
  perform public._t_eq('선수: 팀 읽음 현황 읽기', (select count(*) from public.notice_reads), 2::bigint);

  -- 프로필: 선수 본인은 이름도 못 바꾼다(코치가 선수단에서 수정), 다른 칼럼은 권한 자체가 없다
  perform public._t_fails('선수: 자기 이름 수정 거부', $q$update public.profiles set name = '별명' where id = '00000000-0000-4000-a000-0000000000a2'$q$);
  perform public._t_fails('선수: role 을 coach 로 바꾸기 거부', $q$update public.profiles set role = 'coach', player_id = null, relation = null where id = '00000000-0000-4000-a000-0000000000a2'$q$);
  perform public._t_fails('선수: team_id 바꾸기 거부', $q$update public.profiles set team_id = 'rlschk-tB' where id = '00000000-0000-4000-a000-0000000000a2'$q$);
  perform public._t_fails('선수: 프로필 삭제 거부', $q$delete from public.profiles where id = '00000000-0000-4000-a000-0000000000a2'$q$);
  perform public._t_eq('선수: my_account', (public.my_account()->>'archived'), 'false');
end $$;
reset role;

-- ═════════════════════════ 4. 학부모(A팀 pA1 의 학부모): 보기 전용 ═════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a3","role":"authenticated"}';
do $$
declare today date := public.kst_today();
begin
  perform public._t_eq('학부모: is_self_player 아님', public.is_self_player(), false);
  perform public._t_eq('학부모: 팀 선수 읽기', (select count(*) from public.players), 3::bigint);
  perform public._t_eq('학부모: 자녀 출석 읽기', (select count(*) from public.attendance where player_id = 'rlschk-pA1' and date = today), 1::bigint);
  perform public._t_eq('학부모: 자녀 피드백 + 팀 전체', (select count(*) from public.feedbacks), 2::bigint);
  perform public._t_eq('학부모: signup_codes 0행', (select count(*) from public.signup_codes), 0::bigint);
  perform public._t_fails('학부모: 자녀 출석 insert 거부',
    format($q$insert into public.attendance (id, team_id, player_id, date, status, source) values ('rlschk-x4','rlschk-tA','rlschk-pA1',%L,'출석','선수')$q$, today + 1));
  perform public._t_eq('학부모: 자녀 출석 update 0행', public._t_rows($q$update public.attendance set status = '출석' where player_id = 'rlschk-pA1'$q$), 0::bigint);
  perform public._t_fails('학부모: 자녀 출석 upsert 거부',
    format($q$insert into public.attendance (id, team_id, player_id, date, status, source) values ('rlschk-x5','rlschk-tA','rlschk-pA1',%L,'출석','선수')
              on conflict (player_id, date) do update set status = excluded.status$q$, today));
  perform public._t_fails('학부모: 읽음 표시 거부', $q$insert into public.notice_reads (notice_id, player_id) values ('rlschk-ntA','rlschk-pA1')
       on conflict (notice_id, player_id) do update set at = now()$q$);
  perform public._t_fails('학부모: players insert 거부',
    $q$insert into public.players (id, team_id, name, position, back_number, grade) values ('rlschk-pX','rlschk-tA','침입','투수',77,1)$q$);
  perform public._t_eq('학부모: 자기 이름 수정', public._t_rows($q$update public.profiles set name = '가나다 엄마' where id = '00000000-0000-4000-a000-0000000000a3'$q$), 1::bigint);
  perform public._t_fails('학부모: relation 을 self 로 바꾸기 거부', $q$update public.profiles set relation = 'self' where id = '00000000-0000-4000-a000-0000000000a3'$q$);
end $$;
reset role;

-- ═════════════════════════ 5. 보관된 선수의 계정: 아무것도 못 읽는다 ═════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a4","role":"authenticated"}';
do $$
declare t text;
begin
  perform public._t_eq('보관 계정: my_team null', public.my_team(), null::text);
  foreach t in array array['teams','players','measurements','feedbacks','games','lineups','signup_codes','attendance',
                           'notices','notice_reads','scheduled_games','tournaments','directions'] loop
    perform public._t_eq('보관 계정: ' || t || ' 0행', public._t_rows(format('select 1 from public.%I', t)), 0::bigint);
  end loop;
  perform public._t_eq('보관 계정: 자기 프로필 1행만', (select count(*) from public.profiles), 1::bigint);
  perform public._t_eq('보관 계정: my_account.archived', (public.my_account()->>'archived'), 'true');
  perform public._t_fails('보관 계정: 출석 insert 거부',
    format($q$insert into public.attendance (id, team_id, player_id, date, status, source) values ('rlschk-x6','rlschk-tA','rlschk-pA3',%L,'출석','선수')$q$, public.kst_today()));
end $$;
reset role;

-- ═════════════════════════ 6. 로그인 전(anon): peek 만 된다 ═════════════════════════
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
declare r json; t text;
begin
  foreach t in array array['teams','profiles','players','measurements','feedbacks','games','lineups','signup_codes',
                           'attendance','notices','notice_reads','scheduled_games','tournaments','directions'] loop
    perform public._t_fails('anon: ' || t || ' 읽기 권한 없음', format('select 1 from public.%I', t));
  end loop;
  perform public._t_fails('anon: redeem 실행 권한 없음', $q$select public.redeem_signup_code('RLSCHK-COACH','x')$q$);
  perform public._t_fails('anon: create_team 실행 권한 없음', $q$select public.create_team('x','y','z')$q$);
  perform public._t_fails('anon: my_team 실행 권한 없음', $q$select public.my_team()$q$);
  perform public._t_fails('anon: 내부 검사 함수 실행 권한 없음', $q$select public._check_signup_code('RLSCHK-COACH', false)$q$);

  perform public._t_eq('peek: unknown', public.peek_signup_code('RLSCHK-NOPE')->>'reason', 'unknown');
  perform public._t_eq('peek: unknown(빈 값)', public.peek_signup_code(null)->>'reason', 'unknown');
  perform public._t_eq('peek: used', public.peek_signup_code('RLSCHK-USED')->>'reason', 'used');
  perform public._t_eq('peek: revoked', public.peek_signup_code('RLSCHK-REVOKED')->>'reason', 'revoked');
  perform public._t_eq('peek: expired', public.peek_signup_code('RLSCHK-EXPIRED')->>'reason', 'expired');
  perform public._t_eq('peek: archived', public.peek_signup_code('RLSCHK-ARCH')->>'reason', 'archived');
  perform public._t_eq('peek: taken', public.peek_signup_code('RLSCHK-TAKEN')->>'reason', 'taken');
  perform public._t_eq('peek: 실패는 ok=false', public.peek_signup_code('RLSCHK-TAKEN')->>'ok', 'false');

  r := public.peek_signup_code('  rlschk-parent2 ');   -- 소문자 · 공백 허용, 만료일 당일은 유효
  perform public._t_eq('peek ok: ok', r->>'ok', 'true');
  perform public._t_eq('peek ok: role', r->>'role', 'player');
  perform public._t_eq('peek ok: relation', r->>'relation', 'parent');
  perform public._t_eq('peek ok: team_name', r->>'team_name', '검사A중');
  perform public._t_eq('peek ok: player_name', r->>'player_name', '라마바');
  perform public._t_eq('peek ok: 내부 id 는 안 나감', (r::jsonb ? 'team_id') or (r::jsonb ? 'player_id'), false);
  r := public.peek_signup_code('RLSCHK-COACH');
  perform public._t_eq('peek 코치 코드: ok', r->>'ok', 'true');
  perform public._t_eq('peek 코치 코드: role', r->>'role', 'coach');
  perform public._t_eq('peek 코치 코드: relation null', r->>'relation', null::text);
end $$;
reset role;

-- ═════════════════════════ 7. 새 가입자 c1: redeem 의 각 reason → 학부모 가입 성공 ═════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}';
do $$
declare r json;
begin
  perform public._t_eq('새 가입자: my_team null', public.my_team(), null::text);
  perform public._t_eq('새 가입자: 선수 0행', (select count(*) from public.players), 0::bigint);
  perform public._t_eq('새 가입자: my_account.profile null', public.my_account()->>'profile', null::text);
  perform public._t_eq('redeem: unknown', public.redeem_signup_code('RLSCHK-NOPE', '')->>'reason', 'unknown');
  perform public._t_eq('redeem: used', public.redeem_signup_code('RLSCHK-USED', '')->>'reason', 'used');
  perform public._t_eq('redeem: revoked', public.redeem_signup_code('RLSCHK-REVOKED', '')->>'reason', 'revoked');
  perform public._t_eq('redeem: expired', public.redeem_signup_code('RLSCHK-EXPIRED', '')->>'reason', 'expired');
  perform public._t_eq('redeem: archived', public.redeem_signup_code('RLSCHK-ARCH', '')->>'reason', 'archived');
  perform public._t_eq('redeem: taken', public.redeem_signup_code('RLSCHK-TAKEN', '')->>'reason', 'taken');
  perform public._t_eq('redeem 실패 뒤 프로필 없음', (select count(*) from public.profiles), 0::bigint);

  r := public.redeem_signup_code('rlschk-parent2', '   ');
  perform public._t_eq('redeem 학부모: ok', r->>'ok', 'true');
  perform public._t_eq('redeem 학부모: 기본 이름', r->'profile'->>'name', '라마바 학부모');
  perform public._t_eq('redeem 학부모: relation', r->'profile'->>'relation', 'parent');
  perform public._t_eq('redeem 학부모: player_id', r->'profile'->>'player_id', 'rlschk-pA2');
  perform public._t_eq('redeem 학부모: email', r->'profile'->>'email', 'rlschk-new1@example.test');
  perform public._t_eq('redeem 뒤: my_team', public.my_team(), 'rlschk-tA');
  perform public._t_eq('redeem 뒤: 팀 선수 읽기', (select count(*) from public.players), 3::bigint);
  perform public._t_eq('redeem 다시: has_profile', public.redeem_signup_code('RLSCHK-SELF2', '')->>'reason', 'has_profile');
  perform public._t_eq('create_team: has_profile', public.create_team('팀', '', '')->>'reason', 'has_profile');
end $$;
reset role;

-- ═════════════════════════ 8. 새 가입자 c2: 쓴 코드는 used, 본인 코드 가입 ═════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c2","role":"authenticated"}';
do $$
declare r json;
begin
  perform public._t_eq('redeem: 방금 쓰인 코드는 used', public.redeem_signup_code('RLSCHK-PARENT2', '')->>'reason', 'used');
  r := public.redeem_signup_code('RLSCHK-SELF2', '다른이름');
  perform public._t_eq('redeem 본인: ok', r->>'ok', 'true');
  perform public._t_eq('redeem 본인: 이름은 선수 이름', r->'profile'->>'name', '라마바');
  perform public._t_eq('redeem 본인: relation', r->'profile'->>'relation', 'self');
  perform public._t_eq('redeem 뒤: is_self_player', public.is_self_player(), true);
end $$;
reset role;

-- ═════════════════════════ 9. 새 가입자 c3: create_team ═════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c3","role":"authenticated"}';
do $$
declare r json; v_team text;
begin
  perform public._t_eq('create_team: 빈 이름 invalid', public.create_team('  ', '서울', '김코치')->>'reason', 'invalid');
  r := public.create_team(' 새로운중학교 ', '대전', '');
  perform public._t_eq('create_team: ok', r->>'ok', 'true');
  v_team := r->>'team_id';
  perform public._t_eq('create_team: 프로필 role', r->'profile'->>'role', 'coach');
  perform public._t_eq('create_team: 기본 코치 이름', r->'profile'->>'name', '코치');
  perform public._t_eq('create_team: my_team', public.my_team(), v_team);
  perform public._t_eq('create_team: 팀 이름 trim', (select name from public.teams), '새로운중학교');
  perform public._t_eq('create_team: 새 팀에 선수 등록', public._t_rows(
    format($q$insert into public.players (id, team_id, name, position, back_number, grade) values ('rlschk-pN1',%L,'첫선수','포수',2,1)$q$, v_team)), 1::bigint);
  perform public._t_eq('create_team: A팀 선수 0행', (select count(*) from public.players where team_id = 'rlschk-tA'), 0::bigint);
  perform public._t_eq('create_team 다시: has_profile', public.create_team('둘째팀', '', '')->>'reason', 'has_profile');
end $$;
reset role;

-- ═════════════════════════ 10. 로그인은 했지만 sub 가 없는 토큰 ═════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
do $$
begin
  perform public._t_eq('sub 없음: redeem unauthenticated', public.redeem_signup_code('RLSCHK-COACH', '')->>'reason', 'unauthenticated');
  perform public._t_eq('sub 없음: create_team unauthenticated', public.create_team('팀', '', '')->>'reason', 'unauthenticated');
  perform public._t_eq('sub 없음: 선수 0행', (select count(*) from public.players), 0::bigint);
end $$;
reset role;

-- ═════════════════════════ 11. 관리자로 뒷정리 확인 ═════════════════════════
do $$
begin
  perform public._t_eq('코드 used 처리(학부모)', (select used from public.signup_codes where code = 'RLSCHK-PARENT2'), true);
  perform public._t_eq('코드 used 처리(본인)', (select used from public.signup_codes where code = 'RLSCHK-SELF2'), true);
  perform public._t_eq('실패한 redeem 은 코드를 쓰지 않음', (select used from public.signup_codes where code = 'RLSCHK-TAKEN'), false);
  -- 선수 삭제 시 딸린 행이 함께 지워진다(FK on delete cascade)
  delete from public.players where id = 'rlschk-pA1';
  perform public._t_eq('선수 삭제 cascade: 프로필', (select count(*) from public.profiles where player_id = 'rlschk-pA1'), 0::bigint);
  perform public._t_eq('선수 삭제 cascade: 출석', (select count(*) from public.attendance where player_id = 'rlschk-pA1'), 0::bigint);
  perform public._t_eq('선수 삭제 cascade: 측정', (select count(*) from public.measurements where player_id = 'rlschk-pA1'), 0::bigint);
  perform public._t_eq('선수 삭제 cascade: 코드', (select count(*) from public.signup_codes where player_id = 'rlschk-pA1'), 0::bigint);
  raise notice 'ALL RLS CHECKS PASSED';
end $$;

rollback;
