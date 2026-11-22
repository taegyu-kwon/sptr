/* ================================================================
   서버(Supabase) 읽기·쓰기 — 계약은 supabase/CONTRACT.md.
   - 행(snake_case) ↔ 메모리 타입(types.ts 의 DB, schedule.ts 의 ScheduleDB) 변환
   - loadTeam: 내 팀 데이터를 전부 읽어 메모리 DB 모양으로 조립
   - diffDB / diffSchedule: 메모리 변경 전·후를 비교해 서버에 쓸 작업 목록을 만든다
     (화면이 setDB·update 로 직접 고치는 것까지 빠짐없이 서버에 가도록)
   ================================================================ */
import { supabase } from "./supabase";
import type { Op } from "./sync";
import type {
  AttendanceRecord, DB, FeedbackItem, GameRecord, Player, SavedLineup, SignupCode, Snapshot, Team, User,
} from "./types";
import type { DailyNotice, Direction, NoticeRead, ScheduleDB, ScheduledGame, Tournament } from "./schedule";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export class RemoteError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

const fail = (error: { message?: string; code?: string } | null, fallback = "서버 오류"): never => {
  throw new RemoteError(error?.message || fallback, error?.code);
};

/** 서버·네트워크 오류 → 화면에 보일 한국어 문구 */
export function errorText(err: unknown): string {
  const e = err as { message?: string; code?: string; status?: number; name?: string } | null;
  const msg = (e?.message ?? "").toLowerCase();
  const code = e?.code ?? "";
  if (code === "denied" || code === "42501" || msg.includes("row-level security") || msg.includes("permission denied"))
    return "권한이 없어 저장하지 못했습니다.";
  if (code === "missing") return "고치려는 항목이 서버에 없어 저장하지 못했습니다(다른 기기에서 지워졌을 수 있습니다).";
  if (code === "23505") return "다른 기기에서 먼저 저장한 내용과 겹칩니다. 최신 내용으로 다시 불러왔습니다.";
  if (code === "23503") return "연결된 데이터가 없어 저장하지 못했습니다(다른 기기에서 지워졌을 수 있습니다).";
  if (code === "23514") return "입력값이 허용 범위를 벗어나 저장하지 못했습니다.";
  if (code === "PGRST205" || code === "PGRST202" || code === "42P01" || code === "42883")
    return "서버가 아직 준비되지 않았습니다(테이블이 없습니다). 관리자에게 문의하세요.";
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network") || msg.includes("load failed") || e?.name === "AuthRetryableFetchError")
    return "서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.";
  if (msg.includes("jwt") || code === "PGRST301" || code === "PGRST303") return "로그인이 만료됐습니다. 다시 로그인해 주세요.";
  return "서버에 저장하지 못했습니다. 잠시 뒤 다시 시도하세요.";
}

/** Supabase Auth 오류 → 한국어 문구 */
export function authErrorText(err: unknown): string {
  const e = err as { message?: string; code?: string; status?: number; name?: string } | null;
  const msg = (e?.message ?? "").toLowerCase();
  const code = e?.code ?? "";
  if (code === "invalid_credentials" || msg.includes("invalid login credentials"))
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered") || msg.includes("already been registered"))
    return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (code === "email_not_confirmed" || msg.includes("email not confirmed"))
    return "이메일 확인이 끝나지 않았습니다. 메일의 링크를 누른 뒤 로그인해 주세요.";
  if (code === "weak_password" || msg.includes("password should be")) return "비밀번호는 6자 이상이어야 합니다.";
  if (code === "same_password" || msg.includes("different from the old password")) return "현재 비밀번호와 다른 비밀번호를 입력하세요.";
  if (code === "email_address_invalid" || code === "validation_failed" || msg.includes("invalid format") || msg.includes("is invalid"))
    return "이메일 주소 형식을 확인하세요.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || e?.status === 429 || msg.includes("rate limit"))
    return "요청이 너무 많습니다. 잠시 뒤 다시 시도하세요.";
  if (code === "signup_disabled" || msg.includes("signups not allowed")) return "지금은 새 계정을 만들 수 없습니다. 관리자에게 문의하세요.";
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed") || e?.name === "AuthRetryableFetchError")
    return "서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.";
  return "요청을 처리하지 못했습니다. 잠시 뒤 다시 시도하세요.";
}

/* ---------- 값 변환 ---------- */

/** timestamptz 로 보낼 값 — 시간대가 붙은 ISO. 시간대 없는 문자열은 이 기기의 현지 시각으로 읽는다 */
const ts = (v: string | undefined | null): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const tsNow = (v: string | undefined | null) => ts(v) ?? new Date().toISOString();
/** 읽은 timestamptz → 앱이 쓰는 ISO(…Z) */
const fromTs = (v: string | null | undefined): string | undefined => (v ? ts(v) ?? undefined : undefined);
/** undefined → null */
const n = <T,>(v: T | undefined | null): T | null => (v === undefined ? null : v);
/** null·undefined 인 선택 필드는 뺀다 */
function compact<T extends object>(o: T): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) out[k] = v;
  return out as T;
}

/* ---------- 행 ↔ 타입 ---------- */

const teamFrom = (r: Row): Team => ({ id: r.id, name: r.name, region: r.region ?? "" });

export const userFrom = (r: Row): User =>
  compact({
    id: r.id, email: r.email ?? "", password: "", name: r.name, role: r.role, teamId: r.team_id,
    playerId: r.player_id ?? null, relation: r.relation ?? undefined,
  }) as User & { playerId: string | null } as User;

const playerRow = (p: Player): Row => ({
  id: p.id, team_id: p.teamId, name: p.name, position: p.position, position_detail: n(p.positionDetail),
  throws: n(p.throws), bats: n(p.bats), back_number: p.backNumber, grade: p.grade,
  status: n(p.status), archived: n(p.archived), sbi_metrics: n(p.sbiMetrics),
  sbi_history: p.sbiHistory ?? (p.sbiMetrics ? [p.sbiMetrics] : []),
});
const playerFrom = (r: Row, records: Snapshot[]): Player =>
  compact({
    id: r.id, name: r.name, teamId: r.team_id, position: r.position, backNumber: r.back_number, grade: r.grade,
    positionDetail: r.position_detail, throws: r.throws, bats: r.bats, records,
    sbiMetrics: r.sbi_metrics, sbiHistory: Array.isArray(r.sbi_history) ? r.sbi_history : [],
    status: r.status, archived: r.archived,
  }) as Player;

const measurementRow = (p: Player, s: Snapshot): Row => ({
  player_id: p.id, team_id: p.teamId, date: s.date, body: s.body, athletic: s.athletic, practical: s.practical,
});
const snapshotFrom = (r: Row): Snapshot => ({ date: r.date, body: r.body, athletic: r.athletic, practical: r.practical });

const feedbackRow = (f: FeedbackItem): Row => ({
  id: f.id, team_id: f.teamId, player_id: n(f.playerId), author: f.author, date: f.date,
  category: f.category, content: f.content, updated_at: ts(f.updatedAt),
});
const feedbackFrom = (r: Row): FeedbackItem =>
  compact({
    id: r.id, teamId: r.team_id, playerId: r.player_id ?? null, author: r.author, date: r.date,
    category: r.category, content: r.content, updatedAt: fromTs(r.updated_at),
  }) as FeedbackItem & { playerId: string | null } as FeedbackItem;

const gameRow = (g: GameRecord): Row => ({
  id: g.id, team_id: g.teamId, date: g.date, type: n(g.type), opponent: g.opponent,
  score_for: g.scoreFor, score_against: g.scoreAgainst, result: g.result,
  batting: g.batting ?? [], pitching: g.pitching ?? [], scheduled_game_id: n(g.scheduledGameId),
});
const gameFrom = (r: Row): GameRecord =>
  compact({
    id: r.id, teamId: r.team_id, date: r.date, type: r.type, opponent: r.opponent,
    scoreFor: r.score_for, scoreAgainst: r.score_against, result: r.result,
    batting: r.batting ?? [], pitching: r.pitching ?? [], scheduledGameId: r.scheduled_game_id,
  }) as GameRecord;

const lineupRow = (l: SavedLineup): Row => ({
  id: l.id, team_id: l.teamId, game_id: n(l.gameId), use_dh: l.useDH, order: l.order,
  pitcher_id: n(l.pitcherId), memo: l.memo ?? "", published: l.published, updated_at: tsNow(l.updatedAt), author: l.author ?? "",
});
const lineupFrom = (r: Row): SavedLineup => ({
  id: r.id, teamId: r.team_id, gameId: r.game_id ?? null, useDH: r.use_dh, order: r.order ?? [],
  pitcherId: r.pitcher_id ?? null, memo: r.memo ?? "", published: r.published,
  updatedAt: fromTs(r.updated_at) ?? "", author: r.author ?? "",
});

const codeRow = (c: SignupCode): Row => ({
  code: c.code, team_id: c.teamId, role: c.role,
  relation: c.role === "player" ? c.relation ?? "self" : null,
  player_id: n(c.playerId), player_name: n(c.playerName), used: c.used,
  issued_at: n(c.issuedAt), expires_at: n(c.expiresAt), revoked: !!c.revoked,
});
const codeFrom = (r: Row): SignupCode =>
  ({
    ...compact({
      code: r.code, role: r.role, teamId: r.team_id, used: !!r.used, playerId: r.player_id,
      issuedAt: r.issued_at, expiresAt: r.expires_at, revoked: r.revoked ? true : undefined, relation: r.relation,
    }),
    playerName: r.player_name ?? null,
  }) as SignupCode;

const attendanceRow = (a: AttendanceRecord): Row => ({
  id: a.id, team_id: a.teamId, player_id: a.playerId, date: a.date, status: a.status,
  note: n(a.note), checked_at: ts(a.checkedAt), source: n(a.source),
});
const attendanceFrom = (r: Row): AttendanceRecord =>
  compact({
    id: r.id, teamId: r.team_id, playerId: r.player_id, date: r.date, status: r.status,
    note: r.note, checkedAt: fromTs(r.checked_at), source: r.source,
  }) as AttendanceRecord;

const noticeRow = (x: DailyNotice): Row => ({
  id: x.id, team_id: x.teamId, date: x.date, off: !!x.off, meet_time: x.meetTime ?? "", place: x.place ?? "",
  bring: x.bring ?? "", message: x.message ?? "", items: x.items ?? [], author: x.author ?? "", updated_at: tsNow(x.updatedAt),
});
const noticeFrom = (r: Row, reads: NoticeRead[]): DailyNotice => ({
  id: r.id, teamId: r.team_id, date: r.date, off: !!r.off, meetTime: r.meet_time ?? "", place: r.place ?? "",
  bring: r.bring ?? "", message: r.message ?? "", items: r.items ?? [], author: r.author ?? "",
  updatedAt: fromTs(r.updated_at) ?? "", reads,
});
const readRow = (noticeId: string, r: NoticeRead): Row => ({ notice_id: noticeId, player_id: r.playerId, at: tsNow(r.at) });

const sgRow = (g: ScheduledGame): Row => ({
  id: g.id, team_id: g.teamId, date: g.date, time: g.time ?? "", kind: g.kind, opponent: g.opponent ?? "",
  place: g.place ?? "", tournament_id: n(g.tournamentId), round: n(g.round),
});
const sgFrom = (r: Row): ScheduledGame =>
  compact({
    id: r.id, teamId: r.team_id, date: r.date, time: r.time, kind: r.kind, opponent: r.opponent, place: r.place,
    tournamentId: r.tournament_id, round: r.round,
  }) as ScheduledGame;

const tournamentRow = (t: Tournament): Row => ({
  id: t.id, team_id: t.teamId, name: t.name, start_date: t.startDate, end_date: t.endDate, place: t.place ?? "",
});
const tournamentFrom = (r: Row): Tournament => ({
  id: r.id, teamId: r.team_id, name: r.name, startDate: r.start_date, endDate: r.end_date, place: r.place ?? "",
});

const directionRow = (d: Direction): Row => ({ team_id: d.teamId, month: d.month, theme: d.theme ?? "", items: d.items ?? [] });
const directionFrom = (r: Row): Direction => ({ teamId: r.team_id, month: r.month, theme: r.theme ?? "", items: r.items ?? [] });

/* ---------- 읽기 ---------- */

const PAGE = 1000;

/** 한 테이블을 끝까지 읽는다(PostgREST 는 1000행에서 자른다). order 는 페이지가 겹치지 않게 유일한 칼럼 조합으로 */
async function readAll(table: string, order: string[], teamId?: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select("*");
    if (teamId) q = q.eq("team_id", teamId);
    for (const col of order) q = q.order(col, { ascending: true });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) fail(error);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const byNum = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export interface TeamData { db: DB; sdb: ScheduleDB }

/** 내 팀 데이터를 전부 읽어 메모리 DB 모양으로 만든다. 권한 밖의 행은 서버가 내려 주지 않는다 */
export async function loadTeam(teamId: string): Promise<TeamData> {
  const [
    teams, profiles, players, measurements, feedbacks, games, lineups, codes, attendance,
    notices, reads, sgames, tournaments, directions,
  ] = await Promise.all([
    readAll("teams", ["id"]),
    readAll("profiles", ["created_at", "id"], teamId),
    readAll("players", ["id"], teamId),
    readAll("measurements", ["player_id", "date"], teamId),
    readAll("feedbacks", ["id"], teamId),
    readAll("games", ["id"], teamId),
    readAll("lineups", ["id"], teamId),
    readAll("signup_codes", ["code"], teamId),
    readAll("attendance", ["date", "player_id"], teamId),
    readAll("notices", ["id"], teamId),
    readAll("notice_reads", ["notice_id", "player_id"]),
    readAll("scheduled_games", ["id"], teamId),
    readAll("tournaments", ["id"], teamId),
    readAll("directions", ["month"], teamId),
  ]);

  const recordsOf = new Map<string, Snapshot[]>();
  for (const m of measurements) {
    const list = recordsOf.get(m.player_id) ?? [];
    list.push(snapshotFrom(m));
    recordsOf.set(m.player_id, list);
  }
  for (const list of recordsOf.values()) list.sort((a, b) => a.date.localeCompare(b.date));

  const readsOf = new Map<string, NoticeRead[]>();
  for (const r of reads) {
    const list = readsOf.get(r.notice_id) ?? [];
    list.push({ playerId: r.player_id, at: fromTs(r.at) ?? "" });
    readsOf.set(r.notice_id, list);
  }

  const db: DB = {
    users: profiles.map(userFrom),
    teams: teams.filter(t => t.id === teamId).map(teamFrom),
    players: players
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || byNum(a.id, b.id))
      .map(p => playerFrom(p, recordsOf.get(p.id) ?? [])),
    feedbacks: feedbacks.sort((a, b) => byNum(a.id, b.id)).map(feedbackFrom),
    training: [],
    games: games.sort((a, b) => String(a.date).localeCompare(String(b.date)) || byNum(a.id, b.id)).map(gameFrom),
    lineups: lineups.map(lineupFrom),
    events: [],
    // 최근에 발급한 코드가 앞에 오게
    codes: codes.sort((a, b) => String(b.issued_at ?? "").localeCompare(String(a.issued_at ?? "")) || a.code.localeCompare(b.code)).map(codeFrom),
    attendance: attendance.map(attendanceFrom),
  };
  const sdb: ScheduleDB = {
    seeded: [teamId], // 서버 팀에는 예시 일정을 자동으로 만들지 않는다
    notices: notices.map(x => noticeFrom(x, readsOf.get(x.id) ?? [])),
    games: sgames.map(sgFrom),
    tournaments: tournaments.map(tournamentFrom),
    directions: directions.map(directionFrom),
  };
  return { db, sdb };
}

/* ---------- 쓰기 ---------- */

const CHUNK = 400;

async function upsertRows(table: string, rows: Row[], onConflict: string) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict });
    if (error) fail(error);
  }
}
async function insertRows(table: string, rows: Row[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + CHUNK));
    if (error) fail(error);
  }
}
/** update — 권한이 없으면 오류 없이 0행이라 돌아온 행 수로 확인한다 */
async function updateRow(table: string, patch: Row, match: Row, zeroCode = "denied") {
  const { data, error } = await supabase.from(table).update(patch).match(match).select();
  if (error) fail(error);
  if (!data || data.length === 0) throw new RemoteError("0 rows updated", zeroCode);
}
/** delete — 권한이 없으면 오류 없이 0행이라 돌아온 행 수로 확인한다 */
async function deleteRow(table: string, match: Row) {
  const { data, error } = await supabase.from(table).delete().match(match).select();
  if (error) fail(error);
  if (!data || data.length === 0) throw new RemoteError("0 rows deleted", "denied");
}

/** 쓰는 사람 — 권한 밖의 쓰기는 서버에 보내지 않는다(학부모는 아무것도 쓰지 않는다) */
export interface Writer {
  userId: string;
  teamId: string;
  role: "coach" | "player";
  relation?: "self" | "parent";
  playerId: string | null;
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** id 로 묶인 목록 비교 → 새로 생겼거나 바뀐 것 / 없어진 것 */
function diffList<T>(prev: T[], next: T[], keyOf: (x: T) => string): { changed: T[]; removed: T[] } {
  if (prev === next) return { changed: [], removed: [] };
  const before = new Map(prev.map(x => [keyOf(x), x]));
  const after = new Set<string>();
  const changed: T[] = [];
  for (const x of next) {
    const k = keyOf(x);
    after.add(k);
    const old = before.get(k);
    if (!old || !same(old, x)) changed.push(x);
  }
  const removed = prev.filter(x => !after.has(keyOf(x)));
  return { changed, removed };
}

/** 메인 DB 변경 전·후 → 서버 쓰기 작업(지우기 먼저, 그다음 부모 → 자식 순서로 쓰기) */
export function diffDB(prev: DB, next: DB, w: Writer): Op[] {
  if (w.relation === "parent") return [];
  const mine = <T extends { teamId: string }>(xs: T[]) => (xs.every(x => x.teamId === w.teamId) ? xs : xs.filter(x => x.teamId === w.teamId));
  const dels: Op[] = [];
  const ups: Op[] = [];

  // 출석 — 코치는 전부, 선수 본인은 자기 행 쓰기만
  const att = diffList(mine(prev.attendance), mine(next.attendance), a => `${a.playerId}|${a.date}`);
  if (w.role === "player") {
    const own = att.changed.filter(a => a.playerId === w.playerId && a.source === "선수");
    if (own.length) ups.push(() => upsertRows("attendance", own.map(attendanceRow), "player_id,date"));
    return ups;
  }

  // 팀 정보
  for (const t of next.teams) {
    const old = prev.teams.find(x => x.id === t.id);
    if (t.id === w.teamId && old && !same(old, t)) ups.push(() => updateRow("teams", { name: t.name, region: t.region }, { id: t.id }));
  }
  // 내 계정 이름(다른 사람의 프로필은 서버 트리거가 맞춘다)
  const meBefore = prev.users.find(u => u.id === w.userId);
  const meAfter = next.users.find(u => u.id === w.userId);
  if (meBefore && meAfter && meBefore.name !== meAfter.name) ups.push(() => updateRow("profiles", { name: meAfter.name }, { id: w.userId }));

  // 선수 + 측정 기록
  if (prev.players !== next.players) {
    const before = new Map(prev.players.map(p => [p.id, p]));
    const playerRows: Row[] = [];
    const playerPatches: [string, Row][] = [];
    const measureRows: Row[] = [];
    for (const p of next.players) {
      if (p.teamId !== w.teamId) continue;
      const old = before.get(p.id);
      if (old === p) continue;
      if (!old) playerRows.push(playerRow(p));
      else if (!same({ ...old, records: null }, { ...p, records: null })) {
        // 이미 있는 선수는 바뀐 칼럼만 고친다 — 옛 화면이 열린 다른 탭·기기에서 저장해도
        // 그 사이 다른 화면에서 고친 칼럼(예: SBI 이력 ↔ 특이사항)을 옛 값으로 덮어쓰지 않게
        const before = playerRow(old);
        const after = playerRow(p);
        const patch: Row = {};
        for (const k of Object.keys(after)) if (!same(before[k], after[k])) patch[k] = after[k];
        if (Object.keys(patch).length) playerPatches.push([p.id, patch]);
      }
      if (old?.records === p.records) continue;
      const oldByDate = new Map((old?.records ?? []).map(r => [r.date, r]));
      const dates = new Set<string>();
      for (const r of p.records) {
        dates.add(r.date);
        if (!same(oldByDate.get(r.date), r)) measureRows.push(measurementRow(p, r));
      }
      for (const r of old?.records ?? []) {
        if (!dates.has(r.date)) dels.push(() => deleteRow("measurements", { player_id: p.id, date: r.date }));
      }
    }
    if (playerRows.length) ups.push(() => upsertRows("players", playerRows, "id"));
    for (const [id, patch] of playerPatches) ups.push(() => updateRow("players", patch, { id }, "missing"));
    if (measureRows.length) ups.push(() => upsertRows("measurements", measureRows, "player_id,date"));
  }

  const simple = <T extends { id: string; teamId: string }>(table: string, a: T[], b: T[], toRow: (x: T) => Row) => {
    const d = diffList(mine(a), mine(b), x => x.id);
    for (const x of d.removed) dels.push(() => deleteRow(table, { id: x.id }));
    if (d.changed.length) ups.push(() => upsertRows(table, d.changed.map(toRow), "id"));
  };
  simple("feedbacks", prev.feedbacks, next.feedbacks, feedbackRow);
  simple("games", prev.games, next.games, gameRow);
  simple("lineups", prev.lineups, next.lineups, lineupRow);

  // 가입 코드 — 발급은 insert, 폐기는 revoked 만 update(선수 이름 표시는 서버가 맞춘다)
  if (prev.codes !== next.codes) {
    const before = new Map(prev.codes.map(c => [c.code, c]));
    const fresh: Row[] = [];
    for (const c of next.codes) {
      if (c.teamId !== w.teamId) continue;
      const old = before.get(c.code);
      if (!old) fresh.push(codeRow(c));
      else if (!!old.revoked !== !!c.revoked) ups.push(() => updateRow("signup_codes", { revoked: !!c.revoked }, { code: c.code }));
    }
    if (fresh.length) ups.push(() => insertRows("signup_codes", fresh));
  }

  for (const a of att.removed) dels.push(() => deleteRow("attendance", { player_id: a.playerId, date: a.date }));
  if (att.changed.length) ups.push(() => upsertRows("attendance", att.changed.map(attendanceRow), "player_id,date"));

  return [...dels, ...ups];
}

/** 일정 DB 변경 전·후 → 서버 쓰기 작업. soft: 선수의 읽음 표시뿐이라 실패해도 조용히 넘어가도 되는 변경 */
export function diffSchedule(prev: ScheduleDB, next: ScheduleDB, w: Writer): { ops: Op[]; soft: boolean } {
  if (w.relation === "parent") return { ops: [], soft: true };
  const mine = <T extends { teamId: string }>(xs: T[]) => (xs.every(x => x.teamId === w.teamId) ? xs : xs.filter(x => x.teamId === w.teamId));
  const dels: Op[] = [];
  const ups: Op[] = [];

  // 읽음 표시 — 새로 생겼거나 시각이 바뀐 것만
  const readRows: Row[] = [];
  if (prev.notices !== next.notices) {
    const before = new Map(prev.notices.map(x => [x.id, x]));
    for (const x of next.notices) {
      if (x.teamId !== w.teamId) continue;
      const old = before.get(x.id);
      if (old === x || old?.reads === x.reads) continue;
      const oldAt = new Map((old?.reads ?? []).map(r => [r.playerId, r.at]));
      for (const r of x.reads ?? []) {
        if (oldAt.get(r.playerId) === r.at) continue;
        if (w.role === "player" && r.playerId !== w.playerId) continue;
        readRows.push(readRow(x.id, r));
      }
    }
  }
  if (w.role === "player") {
    if (readRows.length) ups.push(() => upsertRows("notice_reads", readRows, "notice_id,player_id"));
    return { ops: ups, soft: true };
  }

  const stripReads = (x: DailyNotice) => ({ ...x, reads: null });
  const nd = diffList(mine(prev.notices).map(stripReads), mine(next.notices).map(stripReads), x => x.id);
  for (const x of nd.removed) dels.push(() => deleteRow("notices", { id: x.id }));
  // 수정은 upsert(같은 id 를 update) — 읽음 기록이 남는다
  if (nd.changed.length) ups.push(() => upsertRows("notices", nd.changed.map(x => noticeRow(x as unknown as DailyNotice)), "id"));
  if (readRows.length) ups.push(() => upsertRows("notice_reads", readRows, "notice_id,player_id"));

  const td = diffList(mine(prev.tournaments), mine(next.tournaments), x => x.id);
  for (const x of td.removed) dels.push(() => deleteRow("tournaments", { id: x.id }));
  if (td.changed.length) ups.push(() => upsertRows("tournaments", td.changed.map(tournamentRow), "id"));

  const gd = diffList(mine(prev.games), mine(next.games), x => x.id);
  for (const x of gd.removed) dels.push(() => deleteRow("scheduled_games", { id: x.id }));
  if (gd.changed.length) ups.push(() => upsertRows("scheduled_games", gd.changed.map(sgRow), "id"));

  const dd = diffList(mine(prev.directions), mine(next.directions), x => x.month);
  for (const x of dd.removed) dels.push(() => deleteRow("directions", { team_id: x.teamId, month: x.month }));
  if (dd.changed.length) ups.push(() => upsertRows("directions", dd.changed.map(directionRow), "team_id,month"));

  return { ops: [...dels, ...ups], soft: false };
}

/* ---------- 예시 데이터 올리기 ---------- */

/**
 * 예시 데이터(buildSeed·일정 예시)를 새 팀 id 로 바꿔 코치 권한의 일반 쓰기로 올린다.
 * id 는 DB 전체에서 유일해야 해서 팀 id 를 앞에 붙이고, 참조(jsonb 안의 playerId 포함)도 함께 바꾼다.
 * 계정·가입 코드·예전 훈련표(training·events)는 올리지 않는다.
 */
export async function uploadSeed(
  teamId: string,
  seed: DB,
  sched: Omit<ScheduleDB, "seeded">,
  onProgress: (label: string, done: number, total: number) => void,
): Promise<void> {
  const id = (x: string) => `${teamId}:${x}`;
  const idOrNull = (x: string | null | undefined) => (x ? id(x) : null);

  const players: Player[] = seed.players.map(p => ({ ...p, id: id(p.id), teamId }));
  const feedbacks: FeedbackItem[] = seed.feedbacks.map(f => ({ ...f, id: id(f.id), teamId, playerId: idOrNull(f.playerId) }));
  const games: GameRecord[] = seed.games.map(g => ({
    ...g, id: id(g.id), teamId,
    batting: g.batting.map(b => ({ ...b, playerId: id(b.playerId) })),
    pitching: g.pitching.map(b => ({ ...b, playerId: id(b.playerId) })),
    ...(g.scheduledGameId ? { scheduledGameId: id(g.scheduledGameId) } : {}),
  }));
  const lineups: SavedLineup[] = seed.lineups.map(l => ({
    ...l, id: id(l.id), teamId, gameId: idOrNull(l.gameId), pitcherId: idOrNull(l.pitcherId),
    order: l.order.map(b => (b ? { ...b, playerId: id(b.playerId) } : null)),
  }));
  const attendance: AttendanceRecord[] = seed.attendance.map(a => ({
    ...a, id: `at-${a.date}-${id(a.playerId)}`, teamId, playerId: id(a.playerId),
  }));
  const tournaments: Tournament[] = sched.tournaments.map(t => ({ ...t, id: id(t.id), teamId }));
  const sgames: ScheduledGame[] = sched.games.map(g => ({
    ...g, id: id(g.id), teamId, ...(g.tournamentId ? { tournamentId: id(g.tournamentId) } : {}),
  }));
  const notices: DailyNotice[] = sched.notices.map(x => ({ ...x, id: id(x.id), teamId }));
  const reads: Row[] = notices.flatMap(x => (x.reads ?? []).map(r => readRow(x.id, { ...r, playerId: id(r.playerId) })));
  const directions: Direction[] = sched.directions.map(d => ({ ...d, teamId }));

  // 같은 선수·같은 날짜 측정은 서버에서 1건이라 마지막 것만 남긴다
  const measures = new Map<string, Row>();
  for (const p of players) for (const r of p.records) measures.set(`${p.id}|${r.date}`, measurementRow(p, r));

  const steps: [string, () => Promise<void>][] = [
    [`선수 ${players.length}명`, () => upsertRows("players", players.map(playerRow), "id")],
    ["측정 기록", () => upsertRows("measurements", [...measures.values()], "player_id,date")],
    ["코칭 피드백", () => upsertRows("feedbacks", feedbacks.map(feedbackRow), "id")],
    ["출석 기록", () => upsertRows("attendance", attendance.map(attendanceRow), "player_id,date")],
    ["시합 기록", () => upsertRows("games", games.map(gameRow), "id")],
    ["라인업", () => upsertRows("lineups", lineups.map(lineupRow), "id")],
    ["대회 · 경기 일정", async () => {
      await upsertRows("tournaments", tournaments.map(tournamentRow), "id");
      await upsertRows("scheduled_games", sgames.map(sgRow), "id");
    }],
    ["훈련 공지", async () => {
      await upsertRows("notices", notices.map(noticeRow), "id");
      await upsertRows("notice_reads", reads, "notice_id,player_id");
    }],
    ["월별 훈련 방향", () => upsertRows("directions", directions.map(directionRow), "team_id,month")],
  ];
  for (let i = 0; i < steps.length; i++) {
    onProgress(steps[i][0], i, steps.length);
    await steps[i][1]();
  }
  onProgress("마무리", steps.length, steps.length);
}

/* ---------- RPC ---------- */

export type CodeReason = "unknown" | "used" | "revoked" | "expired" | "archived" | "taken" | "has_profile" | "unauthenticated" | "invalid";

export interface PeekResult {
  ok: boolean;
  reason: CodeReason | null;
  role?: "coach" | "player";
  relation?: "self" | "parent" | null;
  team_name?: string;
  player_name?: string | null;
  expires_at?: string | null;
}

/** RPC 의 reason → 한국어 문구(codes.ts 의 checkSignupCode 와 같은 문구) */
export function codeReasonText(r: { reason?: string | null; relation?: string | null; player_name?: string | null; expires_at?: string | null }): string {
  switch (r.reason) {
    case "unknown": return "등록되지 않은 가입 코드입니다. 코치에게 받은 코드를 다시 확인하세요.";
    case "used": return "이미 가입에 사용된 코드입니다. 가입 코드는 한 번만 쓸 수 있습니다. 로그인하거나 코치에게 새 코드를 요청하세요.";
    case "revoked": return "폐기된 가입 코드입니다. 코치가 새 코드를 발급했을 수 있으니 최신 코드를 확인하세요.";
    case "expired": return `만료된 가입 코드입니다${r.expires_at ? `(만료일 ${r.expires_at})` : ""}. 코치에게 재발급을 요청하세요.`;
    case "archived": return "보관된 선수의 가입 코드입니다. 코치에게 문의하세요.";
    case "taken":
      return `${r.player_name ?? "이"} 선수의 ${r.relation === "parent" ? "학부모" : "본인"} 계정이 이미 있습니다. 계정은 선수 1명당 본인 1개·학부모 1개입니다.`;
    case "has_profile": return "이 계정은 이미 팀에 가입돼 있습니다. 다시 로그인해 주세요.";
    case "unauthenticated": return "로그인이 필요합니다. 이메일 확인을 마친 뒤 로그인해 주세요.";
    case "invalid": return "입력한 내용을 다시 확인하세요.";
    default: return "가입 코드를 확인하지 못했습니다. 잠시 뒤 다시 시도하세요.";
  }
}

async function rpc<T>(name: string, args?: Row): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) fail(error);
  return data as T;
}

export const peekSignupCode = (code: string) => rpc<PeekResult>("peek_signup_code", { p_code: code.trim().toUpperCase() });
export const redeemSignupCode = (code: string, name: string) =>
  rpc<{ ok: boolean; reason: CodeReason | null; profile?: Row }>("redeem_signup_code", { p_code: code.trim().toUpperCase(), p_name: name.trim() });
export const createTeam = (name: string, region: string, coachName: string) =>
  rpc<{ ok: boolean; reason: CodeReason | null; team_id?: string; profile?: Row }>("create_team", {
    p_name: name.trim(), p_region: region.trim(), p_coach_name: coachName.trim(),
  });
export const myAccount = () => rpc<{ ok: boolean; reason: string | null; profile: Row | null; archived: boolean }>("my_account");
