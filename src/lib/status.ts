/* ================================================================
   선수 특이사항(재활·부상 등)과 출석 기록 계산.
   ================================================================ */
import type { AttendanceRecord, AttendanceStatus, Player, PlayerStatusKind } from "./types";
import { daysBetween } from "./schedule";

export const STATUS_KINDS: PlayerStatusKind[] = ["정상", "재활", "부상", "휴식", "기타"];

/** 특이사항이 있는 선수인지 (정상·없음이면 false) */
export const hasStatus = (p: Player) => !!p.status && p.status.kind !== "정상";

/** "재활 중 · 복귀 D-12" 형식. 정상이거나 없으면 null */
export function statusLabel(p: Player, today: string): string | null {
  if (!p.status || p.status.kind === "정상") return null;
  const head = p.status.kind === "기타" ? p.status.note?.trim() || "특이사항" : `${p.status.kind} 중`;
  if (!p.status.returnDate) return head;
  const d = daysBetween(today, p.status.returnDate);
  return `${head} · ${d > 0 ? `복귀 D-${d}` : d === 0 ? "복귀 D-DAY" : "복귀 예정일 지남"}`;
}

/* ---------- 출석 ---------- */

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["출석", "지각", "결석", "사유결석"];

export interface AttendanceSummary {
  total: number;
  counts: Record<AttendanceStatus, number>;
  /** 출석률 = (출석 + 지각) ÷ (기록한 날 − 사유결석). 분모가 0이면 null (결정 24) */
  rate: number | null;
}

export function summarize(records: AttendanceRecord[]): AttendanceSummary {
  const counts: Record<AttendanceStatus, number> = { 출석: 0, 지각: 0, 결석: 0, 사유결석: 0 };
  for (const r of records) counts[r.status] += 1;
  const total = records.length;
  const base = total - counts.사유결석;
  return { total, counts, rate: base > 0 ? (counts.출석 + counts.지각) / base : null };
}

export const fmtRate = (rate: number | null) => (rate === null ? "-" : `${Math.round(rate * 100)}%`);

/** 체크 시각 "16:02". 시각이 없는 예전 기록은 null */
export function fmtTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const attendanceTone = (s: AttendanceStatus) =>
  s === "출석" ? "good" : s === "결석" ? "bad" : s === "지각" ? "warn" : "outline";
