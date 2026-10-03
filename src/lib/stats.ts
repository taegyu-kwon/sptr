import type { BattingLine, GameRecord, PitchingLine } from "./types";

/** 타격 누적 */
export interface BatTotals { ab: number; hits: number; hr: number; rbi: number; sb: number }
/** 투구 누적 */
export interface PitTotals { ip: number; er: number; so: number; bb: number }

const emptyBat = (): BatTotals => ({ ab: 0, hits: 0, hr: 0, rbi: 0, sb: 0 });
const emptyPit = (): PitTotals => ({ ip: 0, er: 0, so: 0, bb: 0 });

const addBat = (t: BatTotals, b: BattingLine): BatTotals => ({
  ab: t.ab + b.ab, hits: t.hits + b.hits, hr: t.hr + b.hr, rbi: t.rbi + b.rbi, sb: t.sb + b.sb,
});
const addPit = (t: PitTotals, p: PitchingLine): PitTotals => ({
  ip: t.ip + p.ip, er: t.er + p.er, so: t.so + p.so, bb: t.bb + p.bb,
});

/** 경기들의 타격 기록을 선수별로 합산한다. 경기·행 순서대로 더하고, 선수는 처음 나온 순서를 유지한다. */
export function battingTotalsByPlayer(games: GameRecord[]): Map<string, BatTotals> {
  const map = new Map<string, BatTotals>();
  for (const g of games)
    for (const b of g.batting) map.set(b.playerId, addBat(map.get(b.playerId) ?? emptyBat(), b));
  return map;
}

/** 경기들의 투구 기록을 선수별로 합산한다. 경기·행 순서대로 더하고, 선수는 처음 나온 순서를 유지한다. */
export function pitchingTotalsByPlayer(games: GameRecord[]): Map<string, PitTotals> {
  const map = new Map<string, PitTotals>();
  for (const g of games)
    for (const p of g.pitching) map.set(p.playerId, addPit(map.get(p.playerId) ?? emptyPit(), p));
  return map;
}

/** 한 선수의 타격 합산 (기록이 없으면 모두 0) */
export const playerBattingTotals = (games: GameRecord[], playerId: string): BatTotals =>
  battingTotalsByPlayer(games).get(playerId) ?? emptyBat();

/** 한 선수의 투구 합산 (기록이 없으면 모두 0) */
export const playerPitchingTotals = (games: GameRecord[], playerId: string): PitTotals =>
  pitchingTotalsByPlayer(games).get(playerId) ?? emptyPit();

/** 타율 = 안타 ÷ 타수. 타수 0이면 null */
export const battingAvg = (hits: number, ab: number): number | null => (ab > 0 ? hits / ab : null);

/** ERA = 자책 × 9 ÷ 이닝. 이닝 0이면 null */
export const eraOf = (er: number, ip: number): number | null => (ip > 0 ? (er * 9) / ip : null);

/** 타율 표기: 0.333 → ".333" */
export const fmtAvg = (v: number) => v.toFixed(3).replace(/^0/, "");

/** ERA 표기: 소수 2자리 */
export const fmtEra = (v: number) => v.toFixed(2);
