import type { Player, SbiMetrics } from "./types";
import { latest } from "./gpe";

export const C_U15 = 5.1;
export const NORM = { vertMax: 90, veloMax: 170, sprintBest: 1.2, sprintWorst: 2.2 };

export const clamp100 = (v: number) => Math.max(0, Math.min(100, v));
export const r1 = (v: number) => Math.round(v * 10) / 10;

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
export function scoreBrake(pct: number) {
  if (pct >= 300) return 100;
  if (pct >= 290) return 70 + (pct - 290) * 3;
  if (pct >= 240) return 40 + (pct - 240) * 0.6;
  return pct * (40 / 240);
}
export function scoreAccel(pct: number) {
  if (pct >= 140) return 100;
  if (pct >= 139) return 70 + (pct - 139) * 30;
  if (pct >= 115) return 40 + (pct - 115) * (30 / 24);
  return pct * (40 / 115);
}
export function scoreElbowM2(m: number) {
  if (m >= 8.5) return 100;
  if (m >= 8) return 70 + (m - 8) * 60;
  if (m >= 6) return 40 + (m - 6) * 15;
  return m * (40 / 6);
}

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
  const avg = (sSquat + sDead + sPush) / 3;
  const sbiRaw = ((avg + m.vertical + velo) / (m.sprint * 10)) * C_U15;
  const sbi = clamp100(sbiRaw);

  const brakePct = (m.landDist / height) * 100;
  const accelPct = (m.fullBody / m.upperOnly) * 100;
  const sBrake = clamp100(scoreBrake(brakePct));
  const sAccel = clamp100(scoreAccel(accelPct));
  const sElbow = clamp100(scoreElbowM2(m.elbowThrow));
  const smi = clamp100((sBrake + sAccel + sElbow) / 3);
  const finalR = clamp100(sbi / 2 + smi / 2);

  return {
    sSquat, sDead, sPush, avg, sBrake, sAccel, sElbow, brakePct, accelPct,
    normVert: clamp100((m.vertical / NORM.vertMax) * 100),
    normVelo: clamp100((velo / NORM.veloMax) * 100),
    normSprint: clamp100(((NORM.sprintWorst - m.sprint) / (NORM.sprintWorst - NORM.sprintBest)) * 100),
    sbi, smi, finalR,
  };
}

/** 선수 최신 측정 + 저장된 SBI 메트릭으로 평가. 메트릭 없으면 null */
export function evaluatePlayerSbi(player: Player): SbiResult | null {
  if (!player.sbiMetrics) return null;
  const s = latest(player);
  return evaluateSbi(s.body.height, s.practical.maxVelo, player.sbiMetrics);
}
