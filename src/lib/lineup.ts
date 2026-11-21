/* ================================================================
   정식 경기 라인업 — 타순(1~9번) + 수비 위치 + 선발 투수.
   팀마다 "기본 라인업" 1개(gameId = null)와, 월간 일정의 정식대회 경기별
   "전용 라인업"(gameId = 경기 id)을 둘 수 있다. 전용이 없으면 기본 라인업을 쓴다.
   ================================================================ */
import type { DB, GameRecord, LineupBatter, LineupPos, Player, PositionDetail, SavedLineup } from "./types";
import { evaluatePlayer } from "./gpe";
import { battingTotalsByPlayer, gameTypeOf, opsOf, obpOf } from "./stats";

export const FIELD_POSITIONS: PositionDetail[] = ["투수", "포수", "1루수", "2루수", "3루수", "유격수", "좌익수", "중견수", "우익수"];
export const LINEUP_POSITIONS: LineupPos[] = [...FIELD_POSITIONS, "지명타자"];
export const POS_SHORT: Record<LineupPos, string> = {
  투수: "투", 포수: "포", "1루수": "1루", "2루수": "2루", "3루수": "3루", 유격수: "유", 좌익수: "좌", 중견수: "중", 우익수: "우", 지명타자: "지명",
};

export const emptyOrder = (): (LineupBatter | null)[] => Array.from({ length: 9 }, () => null);

/** 이 라인업에서 선발 투수 id */
export function pitcherOf(l: Pick<SavedLineup, "useDH" | "order" | "pitcherId">): string | null {
  if (l.useDH) return l.pitcherId;
  return l.order.find(b => b?.pos === "투수")?.playerId ?? null;
}

/* ---------- 추천 자동 배치 ---------- */

/** 올해 정식경기 타격 성적이 있으면 OPS, 없으면 종합 점수로 타자 순위를 매긴다 */
function batterScore(p: Player, games: GameRecord[]): { ops: number | null; obp: number | null; total: number } {
  const year = new Date().getFullYear();
  const official = games.filter(g => g.teamId === p.teamId && gameTypeOf(g) === "정식" && g.date.startsWith(String(year)));
  const t = battingTotalsByPlayer(official).get(p.id);
  const enough = t && t.ab >= 10;
  return { ops: enough ? opsOf(t) : null, obp: enough ? obpOf(t) : null, total: evaluatePlayer(p).total };
}

/**
 * 추천 라인업: 세부 포지션별로 종합 점수가 가장 높은 선수를 수비에 세우고,
 * 남은 야수 중 최고를 지명타자로. 선발 투수는 종합 점수 1위 투수.
 * 타순은 OPS(기록이 적으면 종합 점수) 순위 1~3위 → 3·4·5번, 출루율이 가장 높은 나머지 → 1번,
 * 다음 → 2번, 나머지는 6~9번.
 */
export function suggestLineup(players: Player[], games: GameRecord[], useDH = true): Pick<SavedLineup, "useDH" | "order" | "pitcherId"> {
  const scored = players.map(p => ({ p, s: batterScore(p, games) }));
  const byTotal = [...scored].sort((a, b) => b.s.total - a.s.total);
  const pitcher = byTotal.find(x => x.p.position === "투수")?.p ?? null;

  const used = new Set<string>(pitcher ? [pitcher.id] : []);
  const fielders: LineupBatter[] = [];
  for (const pos of FIELD_POSITIONS.slice(1)) {
    const pick = byTotal.find(x => !used.has(x.p.id) && x.p.positionDetail === pos);
    if (pick) {
      used.add(pick.p.id);
      fielders.push({ playerId: pick.p.id, pos });
    }
  }
  // 세부 포지션 선수가 없는 자리는 남은 야수로 채운다
  for (const pos of FIELD_POSITIONS.slice(1)) {
    if (fielders.some(f => f.pos === pos)) continue;
    const pick = byTotal.find(x => !used.has(x.p.id) && x.p.position !== "투수");
    if (pick) {
      used.add(pick.p.id);
      fielders.push({ playerId: pick.p.id, pos });
    }
  }
  if (useDH) {
    const dh = byTotal.find(x => !used.has(x.p.id) && x.p.position !== "투수");
    if (dh) fielders.push({ playerId: dh.p.id, pos: "지명타자" });
  } else if (pitcher) {
    fielders.push({ playerId: pitcher.id, pos: "투수" });
  }

  const sc = (id: string) => scored.find(x => x.p.id === id)!.s;
  const opsKey = (id: string) => sc(id).ops ?? sc(id).total / 100;
  const ranked = [...fielders].sort((a, b) => opsKey(b.playerId) - opsKey(a.playerId));
  // 지명타자 없이 투수가 타석에 서면 9번
  const pitcherBat = !useDH ? ranked.find(b => b.pos === "투수") : undefined;
  const rest = ranked.filter(b => b !== pitcherBat);
  const order = emptyOrder();
  const heart = rest.splice(0, 3);
  heart.forEach((b, i) => (order[2 + i] = b));
  const obpKey = (id: string) => sc(id).obp ?? sc(id).total / 100;
  rest.sort((a, b) => obpKey(b.playerId) - obpKey(a.playerId));
  const lead = rest.shift();
  if (lead) order[0] = lead;
  const second = rest.shift();
  if (second) order[1] = second;
  rest.sort((a, b) => opsKey(b.playerId) - opsKey(a.playerId));
  for (let i = 5; i < 9; i++) order[i] = rest.shift() ?? null;
  if (pitcherBat) order[8] = pitcherBat;
  return { useDH, order, pitcherId: useDH ? pitcher?.id ?? null : null };
}

/* ---------- 찾기 ---------- */

export const defaultLineupOf = (db: DB, teamId: string) => db.lineups.find(l => l.teamId === teamId && l.gameId === null);
export const gameLineupOf = (db: DB, teamId: string, gameId: string) =>
  db.lineups.find(l => l.teamId === teamId && l.gameId === gameId);

/** 이 경기에 실제로 쓰는 라인업: 전용 → 기본. 둘 다 없으면 undefined */
export function effectiveLineup(db: DB, teamId: string, gameId: string | null) {
  if (gameId) {
    const own = gameLineupOf(db, teamId, gameId);
    if (own) return { lineup: own, source: "game" as const };
  }
  const base = defaultLineupOf(db, teamId);
  return base ? { lineup: base, source: "default" as const } : undefined;
}

/* ---------- 선수의 자리 ---------- */

export type MySpot =
  | { kind: "batter"; order: number; pos: LineupPos; alsoPitcher: boolean }
  | { kind: "pitcher" } // 지명타자 사용 — 타석에는 서지 않는 선발 투수
  | { kind: "bench" };

export function spotOf(l: SavedLineup, playerId: string): MySpot {
  const i = l.order.findIndex(b => b?.playerId === playerId);
  if (i >= 0) {
    const b = l.order[i]!;
    return { kind: "batter", order: i + 1, pos: b.pos, alsoPitcher: b.pos === "투수" };
  }
  if (l.useDH && l.pitcherId === playerId) return { kind: "pitcher" };
  return { kind: "bench" };
}

export function spotLabel(s: MySpot): string {
  if (s.kind === "batter") return s.pos === "투수" ? `${s.order}번 타자 · 선발 투수` : `${s.order}번 타자 · ${s.pos}`;
  if (s.kind === "pitcher") return "선발 투수";
  return "벤치 대기";
}

/* ---------- 확인 ---------- */

export interface LineupIssue { level: "error" | "warn"; text: string }

export function checkLineup(l: Pick<SavedLineup, "useDH" | "order" | "pitcherId">, players: Player[]): LineupIssue[] {
  const out: LineupIssue[] = [];
  const name = (id: string) => players.find(p => p.id === id)?.name ?? "알 수 없는 선수";
  const empty = l.order.map((b, i) => (b ? null : i + 1)).filter((x): x is number => x !== null);
  if (empty.length) out.push({ level: "error", text: `${empty.join("·")}번 타순이 비어 있습니다.` });

  const ids = l.order.filter(Boolean).map(b => b!.playerId);
  if (l.useDH && l.pitcherId) ids.push(l.pitcherId);
  const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  dup.forEach(id => out.push({ level: "error", text: `${name(id)} 선수가 두 자리에 들어가 있습니다.` }));

  const need: LineupPos[] = l.useDH ? [...FIELD_POSITIONS.slice(1), "지명타자"] : FIELD_POSITIONS;
  for (const pos of need) {
    const n = l.order.filter(b => b?.pos === pos).length;
    if (n === 0 && !empty.length) out.push({ level: "error", text: `${pos} 자리가 비어 있습니다.` });
    if (n > 1) out.push({ level: "error", text: `${pos}가 ${n}명입니다.` });
  }
  if (l.useDH) {
    if (l.order.some(b => b?.pos === "투수")) out.push({ level: "error", text: "지명타자를 쓰면 투수는 타순에 넣지 않습니다." });
    if (!l.pitcherId) out.push({ level: "error", text: "선발 투수를 정하세요." });
  }
  // 주 포지션이 아닌 자리 — 막지는 않고 알려 준다
  for (const b of l.order) {
    if (!b || b.pos === "지명타자") continue;
    const p = players.find(x => x.id === b.playerId);
    if (p?.positionDetail && p.positionDetail !== b.pos) out.push({ level: "warn", text: `${p.name}: 주 포지션은 ${p.positionDetail}인데 ${b.pos}로 나갑니다.` });
  }
  const sp = pitcherOf(l);
  const spP = sp ? players.find(p => p.id === sp) : undefined;
  if (spP && spP.position !== "투수") out.push({ level: "warn", text: `선발 투수 ${spP.name}의 주 포지션은 ${spP.positionDetail ?? spP.position}입니다.` });
  return out;
}

/* ---------- 전력 지표 (기존 라인업 시뮬레이션 계산 유지) ---------- */

export function lineupStrength(db: DB, l: Pick<SavedLineup, "useDH" | "order" | "pitcherId">) {
  const spId = pitcherOf(l);
  const ids = [...new Set([...l.order.filter(Boolean).map(b => b!.playerId), ...(spId ? [spId] : [])])];
  const players = ids.map(id => db.players.find(p => p.id === id)).filter((p): p is Player => Boolean(p));
  if (players.length === 0) return { avg: 0, attack: 0, defense: 0 };

  const evals = players.map(p => ({ p, r: evaluatePlayer(p) }));
  const avg = Math.round(evals.reduce((s, e) => s + e.r.total, 0) / evals.length);
  const batters = evals.filter(e => l.order.some(b => b?.playerId === e.p.id));
  const attack = batters.length
    ? Math.round(batters.reduce((s, e) => s + e.r.practical.score * 0.6 + e.r.athletic.score * 0.4, 0) / batters.length)
    : 0;
  const sp = evals.find(e => e.p.id === spId);
  const fielders = evals.filter(e => e.p.id !== spId && l.order.some(b => b?.playerId === e.p.id && b.pos !== "지명타자"));
  const defense = Math.round(
    (sp ? sp.r.practical.score * 0.5 : 0) +
      (fielders.length > 0 ? (fielders.reduce((s, e) => s + e.r.practical.score, 0) / fielders.length) * (sp ? 0.5 : 1) : 0)
  );
  return { avg, attack, defense };
}

/* ---------- 예전 형식 변환 ---------- */

type OldLineup = { teamId: string; updatedAt: string; slots: Record<string, string> };

/** 예전 "선발투수 + 1~9번" 슬롯 → 새 형식. 수비 위치는 선수의 세부 포지션으로 채운다 */
export function migrateLineups(lineups: unknown[], players: Player[]): SavedLineup[] {
  return lineups.map((raw, i) => {
    const l = raw as Partial<SavedLineup> & Partial<OldLineup>;
    if (Array.isArray(l.order)) return l as SavedLineup;
    const slots = l.slots ?? {};
    const taken = new Set<LineupPos>();
    const order = emptyOrder().map((_, k) => {
      const pid = slots[`${k + 1}번`];
      const p = players.find(x => x.id === pid);
      if (!p) return null;
      let pos: LineupPos = p.positionDetail && p.positionDetail !== "투수" && !taken.has(p.positionDetail) ? p.positionDetail : "지명타자";
      if (taken.has(pos)) pos = (FIELD_POSITIONS.slice(1) as LineupPos[]).find(x => !taken.has(x)) ?? "지명타자";
      taken.add(pos);
      return { playerId: p.id, pos };
    });
    return {
      id: `lu-old-${i}`, teamId: l.teamId ?? "", gameId: null, useDH: true, order,
      pitcherId: slots["선발투수"] ?? null, memo: "", published: true, updatedAt: l.updatedAt ?? new Date().toISOString(), author: "",
    };
  });
}
