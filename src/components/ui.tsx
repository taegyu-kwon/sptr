import React from "react";
import type { Grade } from "../lib/gpe";
import { Icon } from "./icons";

/* ---------- 등급 · 순위 · 위험도 ---------- */

export function GradeBadge({ grade, size = 24 }: { grade: Grade; size?: number }) {
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

/* ---------- 분할 미터 · 점수 막대 ---------- */

export type MeterTone = "auto" | "fg" | "brand" | "good" | "warn" | "bad" | "dim";

const clamp = (v: number) => Math.max(0, Math.min(100, v));
/** 점수대별 색 — 높을수록 좋은 지표용 */
const autoTone = (s: number): MeterTone => (s >= 80 ? "brand" : s >= 60 ? "fg" : s >= 40 ? "warn" : "bad");

/** 10칸 분할 미터. value 0~100 */
export function Meter({
  value, segments = 10, tone = "auto", size,
}: { value: number; segments?: number; tone?: MeterTone; size?: "sm" | "lg" }) {
  const v = clamp(value);
  const on = Math.round((v / 100) * segments);
  const t = tone === "auto" ? autoTone(v) : tone;
  return (
    <span className={`meter${t !== "fg" ? ` ${t}` : ""}${size ? ` ${size}` : ""}`} role="img" aria-label={`${Math.round(v)} / 100`}>
      {Array.from({ length: segments }, (_, i) => <i key={i} className={i < on ? "on" : ""} />)}
    </span>
  );
}

export type BarTone = MeterTone | "hi" | "mid" | "low" | "crit" | "neutral";
const legacyTone: Record<string, MeterTone> = { hi: "brand", mid: "fg", low: "warn", crit: "bad", neutral: "dim" };

/** 라벨 / 분할 미터 / 값. tone을 주지 않으면 점수대별 색. 낮을수록 좋은 지표는 tone을 직접 준다. */
export function ScoreBar({
  label, score, comment, tone = "auto",
}: { label: string; score: number; comment?: string; tone?: BarTone }) {
  const s = clamp(Math.round(score));
  const t: MeterTone = (legacyTone[tone] ?? tone) as MeterTone;
  return (
    <div className="bar-row" title={comment}>
      <div className="bar-label">{label}</div>
      <Meter value={s} tone={t} />
      <div className="bar-val">{s}</div>
    </div>
  );
}

/* ---------- 링 게이지 ---------- */

export function ScoreRing({
  value, size = 132, stroke = 10, tone = "brand", label, grade, display, children,
}: {
  value: number; size?: number; stroke?: number;
  tone?: "brand" | "fg" | "good" | "warn" | "bad";
  label?: string; grade?: Grade;
  /** 가운데에 보여줄 텍스트. 없으면 value를 반올림해서 보여준다(소수점이 중요한 값은 직접 넘긴다) */
  display?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const v = clamp(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = tone === "fg" ? "var(--fg)" : `var(--${tone})`;
  const fontSize = Math.round(size * 0.3);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-arc"
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        {label && <span className="ring-label">{label}</span>}
        <span className="ring-value" style={{ fontSize: display !== undefined ? Math.round(fontSize * 0.82) : fontSize }}>
          {display !== undefined ? display : Math.round(v)}
        </span>
        {grade && <GradeBadge grade={grade} size={size >= 120 ? 24 : 20} />}
        {children}
      </div>
    </div>
  );
}

/* ---------- 스파크라인 ---------- */

export function Sparkline({
  values, width = 96, height = 28, dim,
}: { values: number[]; width?: number; height?: number; dim?: boolean }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const px = 3, py = 3;
  const pts = values.map((v, i) => {
    const x = px + (i / (values.length - 1)) * (width - px * 2);
    const y = py + (1 - (v - min) / span) * (height - py * 2);
    return [x, y] as const;
  });
  const line = pts.map(p => p.join(",")).join(" ");
  const area = `${pts[0][0]},${height} ${line} ${pts[pts.length - 1][0]},${height}`;
  const last = pts[pts.length - 1];
  return (
    <svg className={`spark${dim ? " dim" : ""}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polygon className="spark-area" points={area} />
      <polyline className="spark-line" points={line} />
      <circle className="spark-dot" cx={last[0]} cy={last[1]} r={2.5} />
    </svg>
  );
}

/* ---------- 증감 ---------- */

export function Delta({
  value, unit = "", vs, digits = 1, invert,
}: { value: number; unit?: string; vs?: string; digits?: number; invert?: boolean }) {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  const dir = rounded > 0 ? "up" : rounded < 0 ? "down" : "";
  const good = invert ? (dir === "down" ? "up" : dir === "up" ? "down" : "") : dir;
  return (
    <span className={`delta${good ? ` ${good}` : ""}`}>
      {rounded > 0 ? "+" : ""}{rounded}{unit}
      {vs && <span className="vs">{vs}</span>}
    </span>
  );
}

/* ---------- 숫자 셀 ---------- */

export function Cells({ n, children, className = "" }: { n?: 2 | 3 | 4 | 5 | 6; children: React.ReactNode; className?: string }) {
  return <div className={`cells${n && n !== 4 ? ` n${n}` : ""} ${className}`.trim()}>{children}</div>;
}

export function Cell({
  label, value, unit, sub, size, grade, meter, meterTone,
}: {
  label: React.ReactNode; value: React.ReactNode; unit?: string; sub?: React.ReactNode;
  size?: "md" | "sm"; grade?: Grade; meter?: number; meterTone?: MeterTone;
}) {
  return (
    <div className="cell">
      <div className="label">{label}</div>
      <div className={`value${size ? ` ${size}` : ""}`}>
        <span>{value}</span>
        {unit && <span className="unit">{unit}</span>}
        {grade && <GradeBadge grade={grade} size={size === "sm" ? 20 : 24} />}
      </div>
      {meter !== undefined && <Meter value={meter} tone={meterTone} />}
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

/* ---------- 숫자 카드(하위 호환) ---------- */

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

/* ---------- 페이지 머리 · 섹션 ---------- */

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

export function Section({
  title, meta, actions, children, className = "",
}: { title?: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`section ${className}`.trim()}>
      {(title || meta || actions) && (
        <div className="section-head">
          {title && <h2 className="section-title">{title}</h2>}
          {meta && <span className="meta">{meta}</span>}
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
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

/* ---------- 알림 · 빈 상태 · 노트 ---------- */

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

export function Note({ children, plain, className = "" }: { children: React.ReactNode; plain?: boolean; className?: string }) {
  return <div className={`note${plain ? " plain" : ""} ${className}`.trim()}>{children}</div>;
}

/* ---------- 이니셜 아바타 ---------- */

export function Avatar({ name, tone, size }: { name: string; tone?: "brand" | "violet"; size?: "sm" | "lg" }) {
  const initial = name.trim().slice(0, 1) || "?";
  return <span className={`avatar${tone ? ` ${tone}` : ""}${size ? ` ${size}` : ""}`}>{initial}</span>;
}
