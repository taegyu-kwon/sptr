import type { DB, Player } from "./types";
import { evaluatePlayer } from "./gpe";

export const LINEUP_SLOTS = ["선발투수", "1번", "2번", "3번", "4번", "5번", "6번", "7번", "8번", "9번"] as const;

/** 저장된 라인업이 없을 때 종합 점수 기준 추천 라인업 생성 */
export function defaultLineup(players: Player[]): Record<string, string> {
  const ranked = players
    .map(p => ({ p, r: evaluatePlayer(p) }))
    .sort((a, b) => b.r.total - a.r.total);

  const slots: Record<string, string> = {};
  const pitchers = ranked.filter(x => x.p.position === "투수");
  if (pitchers.length > 0) slots["선발투수"] = pitchers[0].p.id;

  const batters = ranked.filter(x => x.p.id !== slots["선발투수"]).slice(0, 9);
  // 중심타선(3~5번)에 상위 타자 배치
  const order = [2, 3, 4, 1, 5, 0, 6, 7, 8]; // 타순 인덱스(0=1번)에 들어갈 랭킹 순번
  order.forEach((rankIdx, orderIdx) => {
    const b = batters[rankIdx];
    if (b) slots[`${orderIdx + 1}번`] = b.p.id;
  });
  return slots;
}

export function currentLineup(db: DB, teamId: string): Record<string, string> {
  const saved = db.lineups.find(l => l.teamId === teamId);
  if (saved) return saved.slots;
  return defaultLineup(db.players.filter(p => p.teamId === teamId));
}

/** 라인업 전력 지표 */
export function lineupStrength(db: DB, slots: Record<string, string>) {
  const ids = Object.values(slots).filter(Boolean);
  const players = ids
    .map(id => db.players.find(p => p.id === id))
    .filter((p): p is Player => Boolean(p));
  if (players.length === 0) return { avg: 0, attack: 0, defense: 0 };

  const evals = players.map(p => ({ p, r: evaluatePlayer(p) }));
  const avg = Math.round(evals.reduce((s, e) => s + e.r.total, 0) / evals.length);
  const attack = Math.round(
    evals.reduce((s, e) => s + e.r.practical.score * 0.6 + e.r.athletic.score * 0.4, 0) / evals.length
  );
  const spId = slots["선발투수"];
  const sp = evals.find(e => e.p.id === spId);
  const fielders = evals.filter(e => e.p.id !== spId);
  const defense = Math.round(
    (sp ? sp.r.practical.score * 0.5 : 0) +
      (fielders.length > 0
        ? (fielders.reduce((s, e) => s + e.r.practical.score, 0) / fielders.length) * (sp ? 0.5 : 1)
        : 0)
  );
  return { avg, attack, defense };
}
