-- SPTR rollback: 001~003 이 만든 것을 전부 지운다. 데이터도 함께 사라진다(되돌릴 수 없음).
-- auth.users(가입 계정)는 건드리지 않는다. 계정까지 지우려면 Supabase 대시보드 Authentication 에서 지운다.
-- 여러 번 실행해도 된다.

-- RPC
drop function if exists public.my_account();
drop function if exists public.create_team(text, text, text);
drop function if exists public.redeem_signup_code(text, text);
drop function if exists public.peek_signup_code(text);
drop function if exists public._check_signup_code(text, boolean);

-- 테이블(정책 · 트리거 · 인덱스 · 제약이 함께 지워진다)
drop table if exists public.notice_reads    cascade;
drop table if exists public.notices         cascade;
drop table if exists public.attendance      cascade;
drop table if exists public.signup_codes    cascade;
drop table if exists public.lineups         cascade;
drop table if exists public.games           cascade;
drop table if exists public.scheduled_games cascade;
drop table if exists public.tournaments     cascade;
drop table if exists public.directions      cascade;
drop table if exists public.feedbacks       cascade;
drop table if exists public.measurements    cascade;
drop table if exists public.profiles        cascade;
drop table if exists public.players         cascade;
drop table if exists public.teams           cascade;

-- 트리거 함수 · 도우미 함수(정책이 참조하므로 테이블 뒤에 지운다)
drop function if exists public.players_sync_name();
drop function if exists public.profiles_guard();
drop function if exists public.is_self_player();
drop function if exists public.is_coach();
drop function if exists public.my_player();
drop function if exists public.my_role();
drop function if exists public.my_team();
drop function if exists public.kst_today();
