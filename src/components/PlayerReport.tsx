import React from "react";
import type { Player } from "../lib/types";
import { evaluatePlayer, latest } from "../lib/gpe";
import { GradeBadge, ScoreBar, RiskPill } from "./ui";
import { fmtDate } from "../lib/format";

export default function PlayerReport({ player }: { player: Player }) {
  const r = evaluatePlayer(player);
  const snap = latest(player);

  return (
    <>
      <div className="grid cols-4 equal">
        <div className="card stat">
          <span className="label">종합 점수</span>
          <span className="value flex" style={{ gap: 10 }}>
            {r.total} <GradeBadge grade={r.totalGrade} />
          </span>
          <span className="hint">측정일 {fmtDate(snap.date)}</span>
        </div>
        <div className="card stat">
          <span className="label">신체 점수</span>
          <span className="value flex" style={{ gap: 10 }}>
            {r.body.score} <GradeBadge grade={r.body.grade} />
          </span>
          <span className="hint">측정일 {fmtDate(snap.date)}</span>
        </div>
        <div className="card stat">
          <span className="label">운동능력 점수</span>
          <span className="value flex" style={{ gap: 10 }}>
            {r.athletic.score} <GradeBadge grade={r.athletic.grade} />
          </span>
          <span className="hint">측정일 {fmtDate(snap.date)}</span>
        </div>
        <div className="card stat">
          <span className="label">실전 점수</span>
          <span className="value flex" style={{ gap: 10 }}>
            {r.practical.score} <GradeBadge grade={r.practical.grade} />
          </span>
          <span className="hint">측정일 {fmtDate(snap.date)}</span>
        </div>
      </div>

      <div className="grid cols-3 equal mt16">
        {[
          { name: "신체", res: r.body },
          { name: "운동능력", res: r.athletic },
          { name: "실전", res: r.practical },
        ].map(cat => (
          <div className="card" key={cat.name}>
            <h3 className="flex between">
              {cat.name} 세부 지표 <GradeBadge grade={cat.res.grade} size={26} />
            </h3>
            {cat.res.breakdown.map(b => (
              <ScoreBar key={b.label} label={b.label} score={b.score} comment={b.comment} />
            ))}
          </div>
        ))}
      </div>

      <div className="grid cols-2 mt16">
        <div className="card">
          <h3>훈련 우선 순위</h3>
          {r.trainingPriorities.map(t => (
            <div className="feedback-item" key={t.priority}>
              <div className="head">
                <span className="pill info">우선순위 {t.priority}</span>
              </div>
              <b>{t.area}</b>
              <div className="muted small mt8">{t.reason}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 className="flex between">
            부상 리스크 체크 <RiskPill level={r.injuryRisk.level} />
          </h3>
          <ScoreBar label="리스크 지수" score={r.injuryRisk.score} />
          <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
            {r.injuryRisk.factors.map((f, i) => (
              <li key={i} className="small" style={{ marginBottom: 6 }}>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card mt16">
        <h3>예상 성장방향 피드백</h3>
        {r.growthFeedback.map((g, i) => (
          <div className="feedback-item team" key={i}>
            {g}
          </div>
        ))}
      </div>
    </>
  );
}
