import type { BattingLine, GameRecord, GameType, PitchingLine } from "./types";

/** 타격 누적 */
export interface BatTotals {
  games: number; // 출전 경기 수
  ab: number; hits: number; hr: number; rbi: number; sb: number;
  doubles: number; triples: number; runs: number; bb: number; so: number;
}
/** 투구 누적. ip는 ⅓ 단위 표기(5.1 = 5⅓), outs는 아웃카운트 합 */
export interface PitTotals { games: number; ip: number; outs: number; er: number; so: number; bb: number; hits: number }

const emptyBat = (): BatTotals => ({
  games: 0, ab: 0, hits: 0, hr: 0, rbi: 0, sb: 0, doubles: 0, triples: 0, runs: 0, bb: 0, so: 0,
});
const emptyPit = (): PitTotals => ({ games: 0, ip: 0, outs: 0, er: 0, so: 0, bb: 0, hits: 0 });

/* ---------- 이닝 ⅓ 단위 (결정 15) ---------- */

/** 이닝 표기 → 아웃카운트. 5.1 → 16, 5.2 → 17. 소수 자리는 0·1·2만 의미가 있다 */
export function ipToOuts(ip: number): number {
  const whole = Math.floor(ip);
  const frac = Math.round((ip - whole) * 10);
  return whole * 3 + Math.min(Math.max(frac, 0), 2);
}

/** 아웃카운트 → 이닝 표기. 16 → 5.1 */
export const outsToIp = (outs: number): number => Math.floor(outs / 3) + (outs % 3) / 10;

/** 이닝 표기가 ⅓ 단위로 올바른지(소수 첫째 자리가 0·1·2) */
export function isValidIp(ip: number): boolean {
  if (!Number.isFinite(ip) || ip < 0) return false;
  const tenths = Math.round(ip * 10);
  return Math.abs(ip * 10 - tenths) < 1e-6 && tenths % 10 <= 2;
}

/** 이닝 화면 표기: 5.1 → "5⅓" */
export function fmtIp(ip: number): string {
  const outs = ipToOuts(ip);
  const whole = Math.floor(outs / 3);
  const rest = outs % 3;
  return rest === 0 ? String(whole) : `${whole > 0 ? whole : ""}${rest === 1 ? "⅓" : "⅔"}`;
}

/* ---------- 합산 ---------- */

const addBat = (t: BatTotals, b: BattingLine): BatTotals => ({
  games: t.games + 1,
  ab: t.ab + b.ab, hits: t.hits + b.hits, hr: t.hr + b.hr, rbi: t.rbi + b.rbi, sb: t.sb + b.sb,
  doubles: t.doubles + (b.doubles ?? 0), triples: t.triples + (b.triples ?? 0),
  runs: t.runs + (b.runs ?? 0), bb: t.bb + (b.bb ?? 0), so: t.so + (b.so ?? 0),
});
const addPit = (t: PitTotals, p: PitchingLine): PitTotals => {
  const outs = t.outs + ipToOuts(p.ip);
  return {
    games: t.games + 1, outs, ip: outsToIp(outs),
    er: t.er + p.er, so: t.so + p.so, bb: t.bb + p.bb, hits: t.hits + (p.hits ?? 0),
  };
};

/** 경기들의 타격 기록을 선수별로 합산한다. 경기·행 순서대로 더하고, 선수는 처음 나온 순서를 유지한다. */
export function battingTotalsByPlayer(games: GameRecord[]): Map<string, BatTotals> {
  const map = new Map<string, BatTotals>();
  for (const g of games)
    for (const b of g.batting) map.set(b.playerId, addBat(map.get(b.playerId) ?? emptyBat(), b));
  return map;
}

/** 경기들의 투구 기록을 선수별로 합산한다. 이닝은 아웃카운트로 더한다. */
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

/* ---------- 경기 구분 · 시즌 ---------- */

/** 경기 구분. 구분이 없는 예전 기록은 정식경기로 본다 */
export const gameTypeOf = (g: GameRecord): GameType => g.type ?? "정식";

export const GAME_TYPE_LABEL: Record<GameType, string> = { 정식: "정식경기", 연습: "연습경기" };

/** 해당 연도 경기만 */
export const gamesInYear = (games: GameRecord[], year: number) =>
  games.filter(g => g.date.slice(0, 4) === String(year));

/* ---------- 비율 기록 ---------- */

/** 타율 = 안타 ÷ 타수. 타수 0이면 null */
export const battingAvg = (hits: number, ab: number): number | null => (ab > 0 ? hits / ab : null);

/** 출루율 = (안타 + 볼넷) ÷ (타수 + 볼넷). 희생플라이·사구는 따로 받지 않는다 */
export const obpOf = (t: BatTotals): number | null =>
  t.ab + t.bb > 0 ? (t.hits + t.bb) / (t.ab + t.bb) : null;

/** 장타율 = 루타 ÷ 타수 */
export const slgOf = (t: BatTotals): number | null => {
  if (t.ab <= 0) return null;
  const singles = t.hits - t.doubles - t.triples - t.hr;
  return (singles + 2 * t.doubles + 3 * t.triples + 4 * t.hr) / t.ab;
};

/** OPS = 출루율 + 장타율 */
export const opsOf = (t: BatTotals): number | null => {
  const o = obpOf(t), s = slgOf(t);
  return o === null || s === null ? null : o + s;
};

/** ERA = 자책 × 9 ÷ 이닝. ip는 ⅓ 단위 표기. 이닝 0이면 null */
export const eraOf = (er: number, ip: number): number | null => {
  const outs = ipToOuts(ip);
  return outs > 0 ? (er * 27) / outs : null;
};

/** WHIP = (피안타 + 볼넷) ÷ 이닝 */
export const whipOf = (t: PitTotals): number | null => (t.outs > 0 ? ((t.hits + t.bb) * 3) / t.outs : null);

/** 9이닝당 탈삼진 */
export const k9Of = (t: PitTotals): number | null => (t.outs > 0 ? (t.so * 27) / t.outs : null);

/** 타율 표기: 0.333 → ".333", 1.000 → "1.000" */
export const fmtAvg = (v: number) => v.toFixed(3).replace(/^0/, "");

/** ERA 표기: 소수 2자리 */
export const fmtEra = (v: number) => v.toFixed(2);

/** null이면 "-" */
export const orDash = (v: number | null, f: (v: number) => string) => (v === null ? "-" : f(v));
