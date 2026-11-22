-- SPTR 001: 테이블 · 제약 · 인덱스
-- Supabase(Postgres 15+). 여러 번 실행해도 된다(if not exists).
-- id 는 앱이 만드는 text 이며 "전체 DB 에서" 유일해야 한다(팀별이 아님) — CONTRACT.md 참고.
-- 한국어 enum 값은 src/lib/types.ts · schedule.ts 와 글자까지 같다.

-- ───────────────────────── teams ─────────────────────────
create table if not exists public.teams (
  id         text primary key,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  region     text not null default '',
  created_at timestamptz not null default now()
);

-- ───────────────────────── players ─────────────────────────
-- Player.records[] 는 measurements 테이블로 나간다.
create table if not exists public.players (
  id              text primary key,
  team_id         text not null references public.teams(id) on delete cascade,
  name            text not null check (char_length(btrim(name)) >= 1),
  position        text not null check (position in ('투수','포수','내야수','외야수')),
  position_detail text check (position_detail in ('투수','포수','1루수','2루수','3루수','유격수','좌익수','중견수','우익수')),
  throws          text check (throws in ('우','좌')),
  bats            text check (bats in ('우','좌','양')),
  back_number     integer not null check (back_number >= 0),
  grade           integer not null check (grade between 1 and 12),
  status          jsonb check (
                    status is null
                    or (jsonb_typeof(status) = 'object'
                        and status->>'kind' in ('정상','재활','부상','휴식','기타'))),
  archived        jsonb check (
                    archived is null
                    or (jsonb_typeof(archived) = 'object'
                        and archived->>'reason' in ('졸업','이적','기타')
                        and archived ? 'at')),
  sbi_metrics     jsonb check (sbi_metrics is null or jsonb_typeof(sbi_metrics) = 'object'),
  sbi_history     jsonb not null default '[]'::jsonb check (jsonb_typeof(sbi_history) = 'array'),
  created_at      timestamptz not null default now(),
  -- 자식 테이블의 (player_id, team_id) 복합 FK 용: 다른 팀 선수 id 로 행을 만들 수 없게 한다
  constraint players_id_team_key unique (id, team_id)
);
create index if not exists players_team_id_idx on public.players (team_id);

-- ───────────────────────── profiles (= types.ts User, 비밀번호 제외) ─────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null default '',
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  role       text not null check (role in ('coach','player')),
  relation   text check (relation in ('self','parent')),
  team_id    text not null references public.teams(id) on delete cascade,
  player_id  text,
  created_at timestamptz not null default now(),
  constraint profiles_player_fk foreign key (player_id, team_id)
    references public.players(id, team_id) on delete cascade,
  -- 코치: 선수 연결 없음 / 선수 계정: 선수 연결 + 본인·학부모 구분 필수
  constraint profiles_role_shape check (
    (role = 'coach'  and player_id is null and relation is null) or
    (role = 'player' and player_id is not null and relation is not null))
);
create index if not exists profiles_team_id_idx on public.profiles (team_id);
-- 선수 1명당 본인 계정 1개 · 학부모 계정 1개
create unique index if not exists profiles_player_relation_key
  on public.profiles (player_id, relation) where player_id is not null;

-- ───────────────────────── measurements (Player.records[] = Snapshot) ─────────────────────────
create table if not exists public.measurements (
  player_id text not null,
  team_id   text not null references public.teams(id) on delete cascade,
  date      date not null,
  body      jsonb not null check (jsonb_typeof(body) = 'object'),
  athletic  jsonb not null check (jsonb_typeof(athletic) = 'object'),
  practical jsonb not null check (jsonb_typeof(practical) = 'object'
                                  and practical->>'kind' in ('투수','야수')),
  primary key (player_id, date),
  constraint measurements_player_fk foreign key (player_id, team_id)
    references public.players(id, team_id) on delete cascade
);
create index if not exists measurements_team_id_idx on public.measurements (team_id);

-- ───────────────────────── feedbacks ─────────────────────────
create table if not exists public.feedbacks (
  id         text primary key,
  team_id    text not null references public.teams(id) on delete cascade,
  player_id  text,                       -- null = 팀 전체 피드백
  author     text not null default '',
  date       date not null,
  category   text not null default '',
  content    text not null default '',
  updated_at timestamptz,
  constraint feedbacks_player_fk foreign key (player_id, team_id)
    references public.players(id, team_id) on delete cascade
);
create index if not exists feedbacks_team_id_idx on public.feedbacks (team_id);
create index if not exists feedbacks_player_id_idx on public.feedbacks (player_id);

-- ───────────────────────── tournaments ─────────────────────────
create table if not exists public.tournaments (
  id         text primary key,
  team_id    text not null references public.teams(id) on delete cascade,
  name       text not null default '',
  start_date date not null,
  end_date   date not null,
  place      text not null default '',
  constraint tournaments_dates check (end_date >= start_date)
);
create index if not exists tournaments_team_id_idx on public.tournaments (team_id);

-- ───────────────────────── scheduled_games (schedule.ts ScheduledGame) ─────────────────────────
-- tournament_id 는 FK 를 걸지 않는다(느슨한 참조): 앱이 대회를 지운 뒤에도 경기 쪽 id 가 남을 수 있다.
create table if not exists public.scheduled_games (
  id            text primary key,
  team_id       text not null references public.teams(id) on delete cascade,
  date          date not null,
  time          text not null default '',          -- "HH:MM"
  kind          text not null check (kind in ('연습경기','정식대회')),
  opponent      text not null default '',
  place         text not null default '',
  tournament_id text,
  round         text
);
create index if not exists scheduled_games_team_id_idx on public.scheduled_games (team_id);

-- ───────────────────────── games (types.ts GameRecord) ─────────────────────────
-- scheduled_game_id 도 느슨한 참조(FK 없음).
create table if not exists public.games (
  id                text primary key,
  team_id           text not null references public.teams(id) on delete cascade,
  date              date not null,
  type              text check (type in ('정식','연습')),
  opponent          text not null default '',
  score_for         integer not null default 0,
  score_against     integer not null default 0,
  result            text not null check (result in ('승','패','무')),
  batting           jsonb not null default '[]'::jsonb check (jsonb_typeof(batting) = 'array'),
  pitching          jsonb not null default '[]'::jsonb check (jsonb_typeof(pitching) = 'array'),
  scheduled_game_id text
);
create index if not exists games_team_id_idx on public.games (team_id);

-- ───────────────────────── lineups (types.ts SavedLineup) ─────────────────────────
-- game_id(예정 경기 id) · pitcher_id(선수 id) 는 느슨한 참조(FK 없음).
create table if not exists public.lineups (
  id         text primary key,
  team_id    text not null references public.teams(id) on delete cascade,
  game_id    text,                       -- null = 팀 기본 라인업
  use_dh     boolean not null default true,
  "order"    jsonb not null default '[]'::jsonb check (jsonb_typeof("order") = 'array'),
  pitcher_id text,
  memo       text not null default '',
  published  boolean not null default false,
  updated_at timestamptz not null default now(),
  author     text not null default ''
);
create index if not exists lineups_team_id_idx on public.lineups (team_id);
-- 팀당 기본 라인업 1개 + 경기당 전용 라인업 1개
create unique index if not exists lineups_team_game_key
  on public.lineups (team_id, coalesce(game_id, ''));

-- ───────────────────────── signup_codes ─────────────────────────
create table if not exists public.signup_codes (
  code        text primary key check (code = upper(btrim(code)) and char_length(code) between 6 and 40),
  team_id     text not null references public.teams(id) on delete cascade,
  role        text not null check (role in ('coach','player')),
  relation    text check (relation in ('self','parent')),
  player_id   text,
  player_name text,
  used        boolean not null default false,
  issued_at   date,
  expires_at  date,                      -- 이 날까지 사용 가능. null = 만료 없음
  revoked     boolean not null default false,
  constraint signup_codes_player_fk foreign key (player_id, team_id)
    references public.players(id, team_id) on delete cascade,
  constraint signup_codes_role_shape check (
    (role = 'coach'  and player_id is null and relation is null) or
    (role = 'player' and player_id is not null))
);
create index if not exists signup_codes_team_id_idx on public.signup_codes (team_id);
create index if not exists signup_codes_player_id_idx on public.signup_codes (player_id);

-- ───────────────────────── attendance ─────────────────────────
create table if not exists public.attendance (
  id         text primary key,
  team_id    text not null references public.teams(id) on delete cascade,
  player_id  text not null,
  date       date not null,
  status     text not null check (status in ('출석','지각','결석','사유결석')),
  note       text,
  checked_at timestamptz,
  source     text check (source in ('선수','코치')),
  constraint attendance_player_date_key unique (player_id, date),
  constraint attendance_player_fk foreign key (player_id, team_id)
    references public.players(id, team_id) on delete cascade
);
create index if not exists attendance_team_id_idx on public.attendance (team_id);
create index if not exists attendance_team_date_idx on public.attendance (team_id, date);

-- ───────────────────────── notices (schedule.ts DailyNotice, reads 제외) ─────────────────────────
create table if not exists public.notices (
  id         text primary key,
  team_id    text not null references public.teams(id) on delete cascade,
  date       date not null,
  off        boolean not null default false,
  meet_time  text not null default '',
  place      text not null default '',
  bring      text not null default '',
  message    text not null default '',
  items      jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  author     text not null default '',
  updated_at timestamptz not null default now(),
  constraint notices_team_date_key unique (team_id, date)
);
create index if not exists notices_team_id_idx on public.notices (team_id);

-- ───────────────────────── notice_reads (DailyNotice.reads[]) ─────────────────────────
create table if not exists public.notice_reads (
  notice_id text not null references public.notices(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  at        timestamptz not null default now(),
  primary key (notice_id, player_id)
);
create index if not exists notice_reads_player_id_idx on public.notice_reads (player_id);

-- ───────────────────────── directions (schedule.ts Direction) ─────────────────────────
create table if not exists public.directions (
  team_id text not null references public.teams(id) on delete cascade,
  month   text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  theme   text not null default '',
  items   jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  primary key (team_id, month)
);
