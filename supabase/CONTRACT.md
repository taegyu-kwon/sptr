# SPTR 서버 계약서 (앱 ↔ Supabase)

`src/lib/remote.ts` 를 쓰는 사람이 이 문서만 보고 작업할 수 있게 정리했다.
SQL 원본: `migrations/001_schema.sql`(테이블) · `002_rls.sql`(권한) · `003_functions.sql`(RPC). 검사: `tests/rls_check.sql`.

## 0. 먼저 알아야 할 것 (실수하기 쉬운 순서대로)

1. **id 는 DB 전체에서 유일해야 한다(팀별이 아님).** `id text primary key` 라서 두 팀이 같은 id 를 쓰면 나중 팀의 쓰기가 실패한다.
   - 앱이 평소 만드는 id(`p-<Date.now()>`, `uid("sg")` 등)는 그대로 써도 된다.
   - **예시 데이터 업로드는 반드시 id 를 바꿔야 한다.** `buildSeed()`·`buildScheduleSeed()` 의 id(`p1`, `f1`, `g…`, `sg-p0`, `nt-2026-11-22`, `at-<date>-p1`, `lu…`, `tn…`)는 팀마다 같다. 팀 id 를 앞에 붙여라(예: `${teamId}:p1`). 바꿀 때 **참조도 함께** 바꾼다: `measurements.player_id`, `feedbacks.player_id`, `attendance.player_id`·`attendance.id`, `notice_reads.player_id`, `games.batting[].playerId`·`pitching[].playerId`, `games.scheduled_game_id`, `lineups.game_id`·`pitcher_id`·`order[].playerId`, `scheduled_games.tournament_id`. (`notices.items[].id`, `directions.items[].id` 는 jsonb 안쪽이라 안 바꿔도 된다.)
   - 출석 id `at-${date}-${playerId}` 는 playerId 가 유일하면 유일하다.
2. **칼럼명은 snake_case.** 아래 표대로 변환한다. 없는 값(`undefined`)은 `null` 로 보내고, 읽을 때 `null` 은 필드를 빼라(`positionDetail?` 같은 선택 필드).
3. **날짜·시각 형식**
   - `date` 칼럼은 `"YYYY-MM-DD"` 문자열 그대로 주고받는다.
   - `timestamptz` 칼럼(`updated_at`, `checked_at`, `at`, `created_at`)은 **보낼 때 반드시 시간대가 붙은 ISO**(`new Date(x).toISOString()`)로 보낸다. 예시 데이터의 `"2026-11-21T20:00:00"`(시간대 없음)을 그대로 보내면 서버가 UTC 로 읽어 9시간 어긋난다. 읽을 때는 `"2026-11-22T11:00:00+00:00"` 꼴로 오므로 `new Date(x).toISOString()` 으로 맞춘다(문자열 비교를 하는 코드가 있으면 특히).
4. **쓰기 순서**: 부모가 먼저 있어야 한다 — `teams`(RPC) → `players` → `measurements`/`feedbacks`/`attendance`/`signup_codes`/`notice_reads`, `notices` → `notice_reads`. 나머지(`games`, `lineups`, `scheduled_games`, `tournaments`, `directions`)는 순서 무관(느슨한 참조, FK 없음).
5. **RLS 는 조용히 실패한다.** 권한 없는 `update`/`delete` 는 오류가 아니라 **0행**이다. insert·upsert 위반만 오류(`42501`)가 난다. 낙관적 쓰기를 되돌려야 하는지 알려면 `update`/`delete` 에 `.select()` 를 붙여 돌아온 행 수를 확인하라.
6. **로그인 전에는 테이블을 못 읽는다.** anon 에게는 테이블 권한이 없다. 가입 화면은 `peek_signup_code` 만 쓴다.
7. **보관된 선수의 계정**은 로그인은 되지만(Supabase Auth) 팀 데이터가 전부 0행이다. 로그인 직후 `my_account()` 를 불러 `archived: true` 면 "보관된 선수 계정입니다…" 문구를 띄우고 로그아웃시킨다.

## 1. 테이블 ↔ 타입 대응

upsert 는 PostgREST `on_conflict` 에 아래 "upsert 키"를 준다. 모든 테이블에 `team_id` 가 있고(`notice_reads` 제외) 자기 팀 값이어야 한다.

### teams ↔ `Team`
| 칼럼 | 타입 | 필드 | 비고 |
|---|---|---|---|
| id | text PK | id | 서버가 만든다(`t-` + 12자리 hex). 앱은 만들지 않는다 |
| name | text not null | name | 1~60자 |
| region | text not null default '' | region | |
| created_at | timestamptz | – | |

쓰기: insert 는 `create_team` RPC 로만. 코치가 `name`, `region` update. delete 없음.

### profiles ↔ `User` (비밀번호는 Supabase Auth 가 가진다)
| 칼럼 | 타입 | 필드 | 비고 |
|---|---|---|---|
| id | uuid PK → auth.users(id) on delete cascade | id | `auth.uid()` |
| email | text | email | 가입 시점의 이메일 사본 |
| name | text 1~40자 | name | |
| role | text `'coach'`\|`'player'` | role | |
| relation | text `'self'`\|`'parent'`\|null | relation | 코치는 null, 선수 계정은 항상 값이 있다 |
| team_id | text → teams | teamId | |
| player_id | text → players, null | playerId | 코치는 null |
| created_at | timestamptz | – | |

- `User.password` 는 없다. 앱 메모리 DB 에는 `password: ""` 로 채운다. 비밀번호 변경은 `supabase.auth.updateUser`.
- 유일: `(player_id, relation)` — 선수 1명당 본인 1개·학부모 1개.
- 쓰기: insert 는 RPC(`redeem_signup_code`, `create_team`)로만. update 는 **본인 행의 `name` 만**(다른 칼럼을 payload 에 넣으면 `42501`). **선수 본인 계정은 name 도 못 바꾼다** — 코치가 `players.name` 을 고치면 서버 트리거가 본인 계정 이름과 그 선수 코드의 `player_name` 을 맞춘다(앱은 `users`/`codes` 에 따로 쓰지 말고 메모리만 맞추면 된다). delete 없음.
- 읽기: 본인 행 + 코치는 같은 팀 전원. **선수·학부모는 다른 사람의 profiles 를 못 읽는다** → 서버 모드의 `db.users` 는 코치면 팀 전원, 선수면 본인 1명.

### players ↔ `Player` (records 제외)
| 칼럼 | 타입 | 필드 | 비고 |
|---|---|---|---|
| id | text PK | id | |
| team_id | text → teams | teamId | |
| name | text | name | |
| position | text | position | `'투수'\|'포수'\|'내야수'\|'외야수'` |
| position_detail | text null | positionDetail? | `'투수'\|'포수'\|'1루수'\|'2루수'\|'3루수'\|'유격수'\|'좌익수'\|'중견수'\|'우익수'` |
| throws | text null | throws? | `'우'\|'좌'` |
| bats | text null | bats? | `'우'\|'좌'\|'양'` |
| back_number | int ≥ 0 | backNumber | 중복 검사는 앱이 한다(서버 unique 없음) |
| grade | int 1~12 | grade | |
| status | jsonb null | status? | `PlayerStatus` `{kind:'정상'\|'재활'\|'부상'\|'휴식'\|'기타', note?, returnDate?}` |
| archived | jsonb null | archived? | `PlayerArchive` `{reason:'졸업'\|'이적'\|'기타', at:'YYYY-MM-DD'}`. 복원 = `null` |
| sbi_metrics | jsonb null | sbiMetrics? | `SbiMetrics` 객체 그대로 |
| sbi_history | jsonb not null default `[]` | sbiHistory? | `SbiMetrics[]`. 쓸 때 `p.sbiHistory ?? (p.sbiMetrics ? [p.sbiMetrics] : [])`, 읽을 때 배열 그대로 |
| created_at | timestamptz | – | |

- `Player.records` ← `measurements` 를 `player_id` 로 묶어 `date` 오름차순.
- 읽기: 같은 팀 전원(보관 선수 포함 — 앱이 지금처럼 `archived` 로 거른다). 쓰기: 코치.
- upsert 키: `id`.
- **선수 삭제(앱에서는 하지 않음)**: FK `on delete cascade` 로 그 선수의 profiles·measurements·feedbacks(개인)·attendance·signup_codes·notice_reads 가 함께 지워진다. games 의 타격·투구 줄, lineups 의 타순(jsonb 안쪽)은 남는다. 팀 삭제는 팀의 모든 것을 지운다.

### measurements ↔ `Player.records[]` (`Snapshot`)
| 칼럼 | 타입 | 필드 |
|---|---|---|
| player_id | text → players (cascade) | (부모 Player.id) |
| team_id | text → teams | (부모 Player.teamId) |
| date | date | date |
| body | jsonb | body (`BodyData`) |
| athletic | jsonb | athletic (`AthleticData`) |
| practical | jsonb | practical (`PracticalData`, `kind:'투수'\|'야수'` 필수) |

- PK·upsert 키: `(player_id, date)`. **한 선수 하루 1건** — 로컬은 같은 날짜 2건을 허용했지만 서버는 덮어쓴다.
- `updateSnapshot` 에서 날짜가 바뀌면: 옛 `(player_id, 옛 date)` delete + 새 행 upsert. `deleteSnapshot`: 그 행 delete.
- 쓰기: 코치.

### feedbacks ↔ `FeedbackItem`
| 칼럼 | 타입 | 필드 |
|---|---|---|
| id | text PK | id |
| team_id | text | teamId |
| player_id | text null → players (cascade) | playerId (null = 팀 전체) |
| author | text | author |
| date | date | date |
| category | text | category |
| content | text | content |
| updated_at | timestamptz null | updatedAt? |

읽기: 코치는 팀 전부. **선수·학부모는 팀 전체(player_id null) + 자기(자녀) 것만** 내려온다. 쓰기: 코치. upsert 키 `id`.

### games ↔ `GameRecord`
| 칼럼 | 타입 | 필드 |
|---|---|---|
| id | text PK | id |
| team_id | text | teamId |
| date | date | date |
| type | text null `'정식'\|'연습'` | type? |
| opponent | text | opponent |
| score_for / score_against | int | scoreFor / scoreAgainst |
| result | text `'승'\|'패'\|'무'` | result |
| batting | jsonb 배열 | batting (`BattingLine[]` 그대로, 키는 camelCase `playerId, ab, hits, hr, rbi, sb, doubles?, triples?, runs?, bb?, so?`) |
| pitching | jsonb 배열 | pitching (`PitchingLine[]` 그대로 `playerId, ip, er, so, bb, hits?`) |
| scheduled_game_id | text null | scheduledGameId? (FK 없음) |

읽기: 같은 팀. 쓰기: 코치. upsert 키 `id`.

### lineups ↔ `SavedLineup`
| 칼럼 | 타입 | 필드 |
|---|---|---|
| id | text PK | id |
| team_id | text | teamId |
| game_id | text null | gameId (null = 기본 라인업, FK 없음) |
| use_dh | bool | useDH |
| "order" | jsonb 배열 | order (`(LineupBatter\|null)[]`, 원소 `{playerId, pos}` 또는 `null`) |
| pitcher_id | text null | pitcherId |
| memo | text | memo |
| published | bool | published |
| updated_at | timestamptz | updatedAt |
| author | text | author |

- 유일: `(team_id, coalesce(game_id,''))` — 팀당 기본 1개·경기당 1개. 이 유일 조건은 `on_conflict` 로 쓸 수 없으니 **upsert 키는 `id`**. 같은 경기 라인업은 기존 행의 id 를 재사용한다(지금 `Lineup.tsx` 가 `own?.id ?? …` 로 이미 그렇게 한다). 다른 기기가 먼저 만들었다면 `23505` → 되돌리고 다시 읽기.
- 칼럼명 `order` 는 예약어지만 PostgREST 에서는 그냥 `order` 키로 주고받는다. `select=*` 쓰면 신경 쓸 일 없다.
- 읽기: 코치는 전부. **선수·학부모는 `published = true` 만** 내려온다. 쓰기: 코치.
- `archivePlayer` 는 로컬에서 모든 라인업의 타순에서 그 선수를 뺀다 → 바뀐 라인업 행들도 함께 upsert 해야 한다.

### signup_codes ↔ `SignupCode`
| 칼럼 | 타입 | 필드 | 비고 |
|---|---|---|---|
| code | text PK | code | 대문자·앞뒤 공백 없음(검사), 6~40자 |
| team_id | text | teamId | |
| role | text `'coach'\|'player'` | role | |
| relation | text null `'self'\|'parent'` | relation? | 코치 코드는 null. 선수 코드에서 null 이면 본인 |
| player_id | text null → players (cascade) | playerId? | **선수 코드는 필수**(이름으로 찾는 예전 코드는 서버에 없다). 코치 코드는 null |
| player_name | text null | playerName | 표시용. 선수 이름이 바뀌면 서버가 맞춘다 |
| used | bool default false | used | `redeem_signup_code` 가 true 로 바꾼다 |
| issued_at | date null | issuedAt? | |
| expires_at | date null | expiresAt? | 이 날까지 유효(한국 날짜 기준). null = 만료 없음 |
| revoked | bool default false | revoked? | |

- **읽기·쓰기 모두 코치만.** 선수·학부모·anon 은 0행/거부 → 서버 모드에서 선수의 `db.codes` 는 `[]`.
- 발급(`issueCode`, `addPlayer`) = insert, 재발급 시 옛 코드 `revoked=true` update, 폐기 = update. 코드 문자열은 지금처럼 앱의 `randomCode()` 로 만든다(전체 DB 에서 겹치면 `23505` → 다시 뽑아 재시도).
- 가입 검사(`checkCode`, `signup`)는 테이블을 읽지 말고 RPC 로 한다(§3).

### attendance ↔ `AttendanceRecord`
| 칼럼 | 타입 | 필드 |
|---|---|---|
| id | text PK | id (`at-${date}-${playerId}`) |
| team_id | text | teamId |
| player_id | text → players (cascade) | playerId |
| date | date | date |
| status | text `'출석'\|'지각'\|'결석'\|'사유결석'` | status |
| note | text null | note? |
| checked_at | timestamptz null | checkedAt? |
| source | text null `'선수'\|'코치'` | source? |

- 유일: `(player_id, date)`. **upsert 키는 `player_id,date`** (id 도 같은 규칙이라 사실상 같다).
- 읽기: 같은 팀. 쓰기:
  - 코치: 전부(insert/update/delete). `saveAttendance` 의 `status: null` = 그 행 delete.
  - **선수 본인**(`relation='self'`): `player_id` 가 자기이고 `source='선수'`, `date` 가 한국 오늘 ±1일인 행만 insert/update(upsert). delete 불가. 그 밖은 `42501`.
  - 학부모: 쓰기 불가.

### notices ↔ `DailyNotice` (reads 제외)
| 칼럼 | 타입 | 필드 |
|---|---|---|
| id | text PK | id |
| team_id | text | teamId |
| date | date | date |
| off | bool | off |
| meet_time | text | meetTime |
| place / bring / message | text | place / bring / message |
| items | jsonb 배열 | items (`NoticeItem[]` 그대로 `{id, start, end, group:'전체'\|'투수조'\|'야수조', title, detail?, place?}`) |
| author | text | author |
| updated_at | timestamptz | updatedAt |

유일: `(team_id, date)` — 하루 공지 1개. upsert 키 `id`(다른 기기가 같은 날 공지를 다른 id 로 먼저 만들었다면 `23505`). 읽기: 같은 팀. 쓰기: 코치.

### notice_reads ↔ `DailyNotice.reads[]` (`NoticeRead`)
| 칼럼 | 타입 | 필드 |
|---|---|---|
| notice_id | text → notices (cascade) | (부모 DailyNotice.id) |
| player_id | text → players (cascade) | playerId |
| at | timestamptz | at |

- PK·upsert 키: `(notice_id, player_id)`. `team_id` 칼럼이 없다 — RLS 가 공지를 거쳐 팀을 가린다. `select * from notice_reads` 하면 자기 팀 것만 온다(또는 `notices?select=*,notice_reads(player_id,at)` 로 한 번에).
- 쓰기: 선수 본인이 자기 행 upsert(`markNoticeRead`). 코치는 전부. 학부모 불가(학부모 화면에서 읽음 표시를 서버에 쓰지 말 것 — `42501` 난다).
- 공지를 **삭제**하면 읽음도 함께 지워진다. 공지 **수정**은 반드시 update/upsert 로 하라(delete 후 insert 하면 읽음이 날아간다. `hasRead` 는 `at >= updatedAt` 로 판단하니 읽음 행은 남겨 두는 게 맞다).

### scheduled_games ↔ `ScheduledGame` (schedule.ts)
| 칼럼 | 타입 | 필드 |
|---|---|---|
| id | text PK | id |
| team_id | text | teamId |
| date | date | date |
| time | text | time (`"HH:MM"`) |
| kind | text `'연습경기'\|'정식대회'` | kind |
| opponent / place | text | opponent / place |
| tournament_id | text null | tournamentId? (FK 없음) |
| round | text null | round? |

### tournaments ↔ `Tournament`
| 칼럼 | 타입 | 필드 |
|---|---|---|
| id | text PK | id |
| team_id | text | teamId |
| name / place | text | name / place |
| start_date / end_date | date (`end >= start`) | startDate / endDate |

### directions ↔ `Direction`
| 칼럼 | 타입 | 필드 |
|---|---|---|
| team_id | text | teamId |
| month | text `YYYY-MM` | month |
| theme | text | theme |
| items | jsonb 배열 | items (`DirectionItem[]` 그대로 `{id, group, text, done}`) |

PK·upsert 키: `(team_id, month)`.

scheduled_games · tournaments · directions: 읽기 같은 팀, 쓰기 코치.

**서버에 없는 것**: `DB.training`, `DB.events`(체험 모드 전용 → 서버 모드에서는 `[]`), `ScheduleDB.seeded`(서버 모드에서는 `[teamId]` 로 채워 `ensureSeed` 가 예시를 다시 만들지 않게 한다).

## 2. 누가 무엇을 할 수 있나

| 테이블 | 코치(같은 팀) | 선수 본인 | 학부모 | 보관 선수 계정 · 프로필 없는 로그인 | anon |
|---|---|---|---|---|---|
| teams | 읽기, name·region 수정 | 읽기 | 읽기 | – | – |
| profiles | 팀 전원 읽기, 자기 name 수정 | 자기 행 읽기 | 자기 행 읽기, 자기 name 수정 | 자기 행 읽기 | – |
| players · measurements · games · scheduled_games · tournaments · directions · notices | 읽기·쓰기 | 읽기 | 읽기 | – | – |
| feedbacks | 읽기·쓰기 | 팀 전체 + 자기 것 읽기 | 팀 전체 + 자녀 것 읽기 | – | – |
| lineups | 읽기·쓰기 | 공개된 것 읽기 | 공개된 것 읽기 | – | – |
| signup_codes | 읽기·쓰기 | – | – | – | – |
| attendance | 읽기·쓰기 | 읽기, 자기 행 upsert(오늘±1일, source='선수') | 읽기 | – | – |
| notice_reads | 읽기·쓰기 | 읽기, 자기 행 upsert | 읽기 | – | – |
| RPC | my_account | my_account | my_account | my_account, redeem_signup_code, create_team(프로필 없을 때) | peek_signup_code |

"같은 팀"은 서버가 `profiles.team_id` 로 정한다. 앱이 `team_id` 를 속여 보내도 거부된다. 다른 팀 행은 조건 없이 `select *` 해도 오지 않으므로 `loadTeam` 은 필터 없이 읽어도 되지만, 인덱스를 타게 `.eq("team_id", teamId)` 를 붙이는 편이 좋다.

## 3. RPC

전부 `supabase.rpc(name, args)`. 실패는 예외가 아니라 `{ ok: false, reason }` 로 온다(`error` 가 아니라 `data` 를 봐야 한다). `error` 가 오는 경우는 네트워크·권한(anon 이 redeem 호출 등)뿐.

`reason` 값: `unknown` 미등록 코드(선수 코드인데 선수가 없는 경우 포함) · `used` 사용됨 · `revoked` 폐기 · `expired` 만료 · `archived` 보관된 선수의 코드 · `taken` 그 선수의 본인/학부모 계정이 이미 있음 · `has_profile` 이 로그인 사용자는 이미 프로필이 있음 · `unauthenticated` 로그인 안 됨 · `invalid` 인자 오류. 검사 순서는 `codes.ts` 의 `checkSignupCode` 와 같다(미등록 → 사용됨 → 폐기 → 만료 → 보관 → 이미 계정 있음). 한국어 문구는 `codes.ts` 의 것을 reason 별로 고르면 된다.

### `peek_signup_code(p_code text)` — anon · authenticated
코드를 대문자·trim 해서 찾는다. 아무것도 바꾸지 않는다.
```jsonc
// 성공
{ "ok": true, "reason": null, "role": "player", "relation": "parent",
  "team_name": "배명중학교", "player_name": "김민준", "expires_at": "2026-12-06" }
// 실패 — 코드를 찾았으면 문구에 쓸 정보가 같이 온다(만료일 · 선수 이름 · relation)
{ "ok": false, "reason": "expired", "role": "player", "relation": "self",
  "team_name": "…", "player_name": "…", "expires_at": "2026-11-01" }
// 미등록
{ "ok": false, "reason": "unknown" }
```
코치 코드는 `relation`, `player_name` 이 null. `expires_at` 은 null 일 수 있다.

### `redeem_signup_code(p_code text, p_name text)` — authenticated
`auth.signUp` 직후(세션이 생긴 뒤) 호출. 검사 → profiles 행 생성 → 코드 `used=true` 를 한 트랜잭션으로 한다.
- 이름 규칙(store.signup 과 같다): 선수 본인 = 선수 이름(`p_name` 무시) / 학부모 = `p_name`, 비면 `"<선수 이름> 학부모"` / 코치 = `p_name`, 비면 `"코치"`. 40자에서 자른다.
```jsonc
{ "ok": true, "reason": null,
  "profile": { "id": "<uuid>", "email": "…", "name": "…", "role": "player", "relation": "self",
               "team_id": "t-…", "player_id": "p-…", "created_at": "…" } }
{ "ok": false, "reason": "used" /* unknown|revoked|expired|archived|taken|has_profile|unauthenticated */ }
```
주의: **redeem 이 실패하면 Auth 계정만 생기고 프로필이 없는 상태**가 된다(service_role 이 없어 앱이 계정을 지울 수 없다). 그래서 가입 화면은 ① `peek_signup_code` 로 먼저 확인 → ② `auth.signUp` → ③ `redeem_signup_code` 순서로 하고, 로그인했는데 `my_account().profile` 이 null 인 사용자에게는 "가입 코드 입력 / 새 팀 시작" 화면을 보여 다시 redeem 할 수 있게 한다.

### `create_team(p_name text, p_region text, p_coach_name text)` — authenticated
프로필이 없는 로그인 사용자가 팀을 만들고 그 팀의 코치가 된다. 팀 id 는 서버가 만든다.
```jsonc
{ "ok": true, "reason": null, "team_id": "t-3f9a1c0b7d2e",
  "team": { "id": "t-3f9a1c0b7d2e", "name": "…", "region": "…" },
  "profile": { /* profiles 행, role "coach" */ } }
{ "ok": false, "reason": "has_profile" /* invalid(팀 이름 빔) | unauthenticated */ }
```
`p_coach_name` 이 비면 `"코치"`. (확정 정책은 관리자만 팀 생성 — 나중에 `app_admins` 로 좁힌다. 지금은 가입한 누구나 팀을 만들 수 있다.)

### `my_account()` — authenticated (설계에 없던 보조 RPC)
로그인 직후·세션 복원 시 한 번 부른다.
```jsonc
{ "ok": true, "reason": null, "profile": { /* profiles 행 */ } | null, "archived": false }
```
`profile: null` → 아직 가입 코드를 안 쓴 계정. `archived: true` → 보관된 선수의 계정(팀 데이터는 0행).

## 4. loadTeam(teamId) 가 읽을 것

`teams`(1행) · `profiles` · `players` · `measurements` · `feedbacks` · `games` · `lineups` · `signup_codes` · `attendance` · `notices` · `notice_reads` · `scheduled_games` · `tournaments` · `directions` — 14개를 `Promise.all` 로. PostgREST 는 기본 1000행에서 자른다: `attendance`(선수 24명 × 훈련일)와 `measurements`·`notice_reads` 는 한 시즌이면 넘을 수 있으니 `.range()` 로 끝까지 읽거나 날짜 범위를 둔다.

메모리 모양으로 조립:
- `DB.users` ← profiles(+`password: ""`), `DB.teams` ← teams, `DB.players` ← players + measurements 묶기(`records` 는 date 오름차순. 측정이 0건인 선수는 `records: []` — 화면이 최소 1건을 가정하는 곳이 있으니 등록 시 첫 측정을 반드시 함께 쓴다), `DB.codes` ← signup_codes, 나머지는 1:1.
- `ScheduleDB.notices` ← notices + notice_reads 묶기(`reads`), `games` ← scheduled_games, `tournaments`, `directions`.

## 5. Supabase 설정

- SQL Editor 에서 001 → 002 → 003 순서로 실행(여러 번 실행해도 된다). 지우려면 `rollback.sql`(데이터도 지워진다. auth.users 는 남는다).
- Authentication → Sign In / Providers → Email: **Confirm email 끄기**(끄지 않으면 signUp 뒤 세션이 없어 redeem 이 `unauthenticated` 로 실패한다).
- 검사: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_check.sql` 또는 SQL Editor 에 붙여 실행 → `ALL RLS CHECKS PASSED`. 끝에 rollback 하므로 아무것도 남지 않는다.
