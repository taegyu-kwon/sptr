import React from "react";
import { gradeColor, type Grade } from "../lib/gpe";

export function GradeBadge({ grade, size = 34 }: { grade: Grade; size?: number }) {
  return (
    <span className="grade-badge" style={{ color: gradeColor[grade], fontSize: size >= 30 ? 14 : 12.5 }}>
      {grade}
    </span>
  );
}

export function ScoreBar({ label, score, comment }: { label: string; score: number; comment?: string }) {
  return (
    <div className="bar-row" title={comment}>
      <div className="bar-label">{label}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${score}%` }} />
      </div>
      <div className="bar-val">{score}</div>
    </div>
  );
}

export function RiskPill({ level }: { level: "낮음" | "보통" | "높음" }) {
  const cls = level === "낮음" ? "good" : level === "보통" ? "warn" : "bad";
  return <span className={`pill ${cls}`}>부상위험 {level}</span>;
}

const rankColor: Record<number, string> = { 1: "#f5c542", 2: "#c0c0c4", 3: "#d08a4e" };

export function Medal({ rank }: { rank: number }) {
  return (
    <span className="rank-medal" style={rank <= 3 ? { color: rankColor[rank] } : undefined}>
      {rank}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card stat">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
