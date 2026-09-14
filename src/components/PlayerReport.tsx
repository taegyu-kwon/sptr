import React from "react";
import type { Player } from "../lib/types";
import { evaluatePlayer, latest } from "../lib/gpe";
import { GradeBadge, ScoreBar, RiskPill } from "./ui";
import { fmtDate } from "../lib/format";
import "../styles/player.css";

export default function PlayerReport({ player }: { player: Player }) {
  const r = evaluatePlayer(player);
  const snap = latest(player);

  const scores = [
    { label: "종합 점수", score: r.total, grade: r.totalGrade, hint: `측정일 ${fmtDate(snap.date)}` },
    { label: "신체 점수", score: r.body.score, grade: r.body.grade },
    { label: "운동능력 점수", score: r.athletic.score, grade: r.athletic.grade },
    { label: "실전 점수", score: r.practical.score, grade: r.practical.grade },
  ];

  return (
    <>
      <div className="grid cols-4 equal">
        {scores.map(s => (
          <div className="card stat" key={s.label}>
            <span className="label">{s.label}</span>
            <span className="value">
              {s.score} <GradeBadge grade={s.grade} size={30} />
            </span>
            {s.hint && <span className="hint">{s.hint}</span>}
          </div>
        ))}
      </div>

      <div className="grid cols-3 equal mt16">
        {[
          { name: "신체", res: r.body },
          { name: "운동능력", res: r.athletic },
          { name: "실전", res: r.practical },
        ].map(cat => (
          <div className="card" key={cat.name}>
            <div className="card-head">
              <h3>{cat.name} 세부 지표</h3>
              <GradeBadge grade={cat.res.grade} />
            </div>
            {cat.res.breakdown.map(b => (
              <ScoreBar key={b.label} label={b.label} score={b.score} comment={b.comment} />
            ))}
          </div>
        ))}
      </div>

      <div className="grid cols-2 mt16">
        <div className="card">
          <h3>훈련 우선 순위</h3>
          <div className="list">
            {r.trainingPriorities.map(t => (
              <div className="list-row" key={t.priority}>
                <span className="pill outline">{t.priority}순위</span>
                <div className="grow">
                  <div className="title">{t.area}</div>
                  <div className="sub">{t.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>부상 리스크 체크</h3>
            <RiskPill level={r.injuryRisk.level} />
          </div>
          <ScoreBar
            label="리스크 지수"
            score={r.injuryRisk.score}
            tone={r.injuryRisk.level === "낮음" ? "good" : r.injuryRisk.level === "보통" ? "low" : "crit"}
          />
          <ul className="risk-factors small muted">
            {r.injuryRisk.factors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card mt16">
        <h3>예상 성장방향 피드백</h3>
        {r.growthFeedback.map((g, i) => (
          <div className="callout" key={i}>
            {g}
          </div>
        ))}
      </div>
    </>
  );
}
