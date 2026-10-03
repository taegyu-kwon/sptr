import type { Player, SbiMetrics } from "./types";
import { latest } from "./gpe";

export { r1 } from "./format";

export const C_U15 = 5.1;
export const NORM = { vertMax: 90, veloMax: 170, sprintBest: 1.2, sprintWorst: 2.2 };

/** 학년별 3대 스트렝스 부하 — 스쿼트·데드리프트는 체중 대비 비율, 푸쉬업은 가중 kg(0이면 맨몸) */
export const LOADS: Record<string, { squat: number; dead: number; push: number }> = {
  "1": { squat: 0.25, dead: 0.3, push: 0 },
  "2": { squat: 0.33, dead: 0.4, push: 5 },
  "3": { squat: 0.4, dead: 0.5, push: 10 },
};

export const clamp100 = (v: number) => Math.max(0, Math.min(100, v));

// ---------- U15 스트렝스 점수 환산 ----------
export function scoreSquat(x: number) {
  if (x >= 50) return 100;
  if (x >= 40) return 70 + (x - 40) * 3;
  if (x >= 30) return 40 + (x - 30) * 3;
  return x * 1.3;
}
export function scoreDead(x: number) {
  if (x >= 13) return 100;
  if (x >= 9) return 70 + (x - 9) * 7.5;
  if (x >= 6) return 40 + (x - 6) * 10;
  return x * 6.5;
}
export function scorePush(x: number) {
  if (x >= 40) return 100;
  if (x >= 29) return 70 + (x - 29) * 2.7;
  if (x >= 20) return 40 + (x - 20) * 3.3;
  return x * 1.9;
}

// ---------- SMI 점수 환산 ----------
/** 제동력: 신장대비 % */
export function scoreBrake(pct: number) {
  if (pct >= 300) return 100;
  if (pct >= 290) return 70 + (pct - 290) * 3;
  if (pct >= 240) return 40 + (pct - 240) * 0.6;
  return pct * (40 / 240);
}
/** 가속효율: 비대칭비율 % */
export function scoreAccel(pct: number) {
  if (pct >= 140) return 100;
  if (pct >= 139) return 70 + (pct - 139) * 30;
  if (pct >= 115) return 40 + (pct - 115) * (30 / 24);
  return pct * (40 / 115);
}
/** 팔꿈치 폄 속도 Method 2: 무릎 꿇고 메디신볼 비거리(m) */
export function scoreElbowM2(m: number) {
  if (m >= 8.5) return 100;
  if (m >= 8) return 70 + (m - 8) * 60;
  if (m >= 6) return 40 + (m - 6) * 15;
  return m * (40 / 6);
}

// ---------- 조합 공식 ----------
/** 3대 스트렝스 평균 */
export const strengthAvg = (sSquat: number, sDead: number, sPush: number) => (sSquat + sDead + sPush) / 3;
/** SBI 원값(0~100 제한 전) = (스트렝스 평균 + 버티컬 + 구속) ÷ (스프린트 × 10) × C */
export const sbiRawOf = (avg: number, vertical: number, velo: number, sprint: number) =>
  ((avg + vertical + velo) / (sprint * 10)) * C_U15;
/** 제동력 신장대비 % */
export const brakePctOf = (landDist: number, height: number) => (landDist / height) * 100;
/** 가속효율 비대칭비율 % */
export const accelPctOf = (fullBody: number, upperOnly: number) => (fullBody / upperOnly) * 100;
export const smiOf = (sBrake: number, sAccel: number, sElbow: number) => clamp100((sBrake + sAccel + sElbow) / 3);
/** 최종 R = SBI/2 + SMI/2 */
export const finalROf = (sbi: number, smi: number) => clamp100(sbi / 2 + smi / 2);
/** 레이더용 정규화 점수 */
export const normVertOf = (vertical: number) => clamp100((vertical / NORM.vertMax) * 100);
export const normVeloOf = (velo: number) => clamp100((velo / NORM.veloMax) * 100);
export const normSprintOf = (sprint: number) =>
  clamp100(((NORM.sprintWorst - sprint) / (NORM.sprintWorst - NORM.sprintBest)) * 100);

export interface SbiResult {
  sSquat: number;
  sDead: number;
  sPush: number;
  avg: number;
  sBrake: number;
  sAccel: number;
  sElbow: number;
  brakePct: number;
  accelPct: number;
  normVert: number;
  normVelo: number;
  normSprint: number;
  sbi: number;
  smi: number;
  finalR: number;
}

export function evaluateSbi(height: number, velo: number, m: SbiMetrics): SbiResult {
  const sSquat = clamp100(scoreSquat(m.squatReps));
  const sDead = clamp100(scoreDead(m.deadReps));
  const sPush = clamp100(scorePush(m.pushReps));
  const avg = strengthAvg(sSquat, sDead, sPush);
  const sbi = clamp100(sbiRawOf(avg, m.vertical, velo, m.sprint));

  const brakePct = brakePctOf(m.landDist, height);
  const accelPct = accelPctOf(m.fullBody, m.upperOnly);
  const sBrake = clamp100(scoreBrake(brakePct));
  const sAccel = clamp100(scoreAccel(accelPct));
  const sElbow = clamp100(scoreElbowM2(m.elbowThrow));
  const smi = smiOf(sBrake, sAccel, sElbow);
  const finalR = finalROf(sbi, smi);

  return {
    sSquat, sDead, sPush, avg, sBrake, sAccel, sElbow, brakePct, accelPct,
    normVert: normVertOf(m.vertical),
    normVelo: normVeloOf(velo),
    normSprint: normSprintOf(m.sprint),
    sbi, smi, finalR,
  };
}

/** 선수 최신 측정 + 저장된 SBI 메트릭으로 평가. 메트릭 없으면 null */
export function evaluatePlayerSbi(player: Player): SbiResult | null {
  if (!player.sbiMetrics) return null;
  const s = latest(player);
  return evaluateSbi(s.body.height, s.practical.maxVelo, player.sbiMetrics);
}
