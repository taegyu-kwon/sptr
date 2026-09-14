import React from "react";
import type { Grade } from "../lib/gpe";
import { Icon } from "./icons";

/* ---------- 등급 · 순위 · 위험도 ---------- */

export function GradeBadge({ grade, size = 22 }: { grade: Grade; size?: number }) {
  const cls = size >= 30 ? " lg" : size < 22 ? " sm" : "";
  return <span className={`grade grade-${grade}${cls}`}>{grade}</span>;
}

export function Medal({ rank }: { rank: number }) {
  return <span className={`rank${rank <= 3 ? ` r${rank}` : ""}`}>{rank}</span>;
}

export function RiskPill({ level }: { level: "낮음" | "보통" | "높음" }) {
  const cls = level === "낮음" ? "good" : level === "보통" ? "warn" : "bad";
  return (
    <span className={`pill ${cls}`}>
      <span className="dot" />
      부상위험 {level}
    </span>
  );
}

/* ---------- 점수 막대 ---------- */

const band = (s: number) => (s >= 80 ? "hi" : s >= 60 ? "mid" : s >= 40 ? "low" : "crit");

export type BarTone = "auto" | "good" | "neutral" | "low" | "crit" | "hi";

/** tone을 주지 않으면 점수대별로 색이 정해진다(높을수록 좋은 지표용). 낮을수록 좋은 지표는 tone을 직접 준다. */
export function ScoreBar({
  label, score, comment, tone = "auto",
}: { label: string; score: number; comment?: string; tone?: BarTone }) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const cls = tone === "auto" ? band(s) : tone;
  return (
    <div className="bar-row" title={comment}>
      <div className="bar-label">{label}</div>
      <div className="bar-track">
        <div className={`bar-fill ${cls}`} style={{ width: `${s}%` }} />
      </div>
      <div className="bar-val">{s}</div>
    </div>
  );
}

/* ---------- 숫자 카드 ---------- */

export function Stat({
  label, value, hint, small,
}: { label: string; value: React.ReactNode; hint?: React.ReactNode; small?: boolean }) {
  return (
    <div className="card stat">
      <span className="label">{label}</span>
      <span className={`value${small ? " sm" : ""}`}>{value}</span>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/* ---------- 페이지 머리 ---------- */

export function PageHead({
  title, desc, actions,
}: { title: React.ReactNode; desc?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {desc && <p className="page-desc">{desc}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

/* ---------- 세그먼트 컨트롤 ---------- */

export function Seg<T extends string>({
  value, onChange, options, small,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; small?: boolean }) {
  return (
    <div className={`seg${small ? " sm" : ""}`} role="tablist">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- 알림 · 빈 상태 ---------- */

export function Notice({
  kind = "info", children, className = "",
}: { kind?: "info" | "ok" | "error" | "warn"; children: React.ReactNode; className?: string }) {
  const icon =
    kind === "ok" ? <Icon.Check /> : kind === "error" ? <Icon.Alert /> : kind === "warn" ? <Icon.Alert /> : <Icon.Info />;
  return (
    <div className={`notice ${kind} ${className}`.trim()} role={kind === "error" ? "alert" : "status"}>
      {icon}
      <div>{children}</div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

/* ---------- 이니셜 아바타 ---------- */

export function Avatar({ name, tone, small }: { name: string; tone?: "brand" | "violet"; small?: boolean }) {
  const initial = name.trim().slice(0, 1) || "?";
  return <span className={`avatar${tone ? ` ${tone}` : ""}${small ? " sm" : ""}`}>{initial}</span>;
}
