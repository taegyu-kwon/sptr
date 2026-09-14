import React, { useMemo } from "react";
import type { Player } from "../lib/types";
import { evaluate, evaluatePlayer, latest } from "../lib/gpe";
import { Cells, Cell, Delta, GradeBadge, Note, RiskPill, ScoreBar, ScoreRing, Section, Sparkline } from "./ui";
import { fmtDate } from "../lib/format";
import "../styles/player.css";

const riskTone = (level: "낮음" | "보통" | "높음") => (level === "낮음" ? "good" : level === "보통" ? "warn" : "bad");
const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 선수와 코치가 같이 쓰는 능력치 리포트.
 * header: 히어로 패널 맨 위에 그릴 요소(프로필 등). after: 히어로 바로 뒤에 끼울 섹션.
 */
export default function PlayerReport({
  player, header, after,
}: { player: Player; header?: React.ReactNode; after?: React.ReactNode }) {
  const r = evaluatePlayer(player);
  const snap = latest(player);
  const records = player.records;

  const prev = useMemo(
    () => (records.length >= 2 ? evaluate(records[records.length - 2]) : null),
    [records]
  );
  const history = useMemo(() => records.map(s => evaluate(s).total), [records]);

  const cats = [
    { name: "신체", res: r.body, prevScore: prev?.body.score },
    { name: "운동능력", res: r.athletic, prevScore: prev?.athletic.score },
    { name: "실전", res: r.practical, prevScore: prev?.practical.score },
  ];

  return (
    <>
      {/* 1. 히어로 — 종합 점수가 주인공 */}
      <div className="panel hero">
        <span className="watermark" aria-hidden="true">{player.backNumber}</span>
        {header && <div className="report-head">{header}</div>}

        <div className="split report-body">
          <div className="hero-lead">
            <ScoreRing value={r.total} size={148} stroke={11} grade={r.totalGrade} label="종합" />
            <div className="hero-summary">
              <span className="eyebrow">종합 점수</span>
              {prev && <Delta value={r.total - prev.total} vs="직전 대비" />}
              <Sparkline values={history} width={120} height={32} />
              <span className="faint xs">측정 {records.length}회 · 최근 {fmtDate(snap.date)}</span>
            </div>
          </div>

          <Cells n={3}>
            {cats.map(c => (
              <Cell
                key={c.name}
                label={c.name}
                value={c.res.score}
                grade={c.res.grade}
                meter={c.res.score}
                sub={c.prevScore !== undefined && <Delta value={c.res.score - c.prevScore} vs="직전 대비" />}
              />
            ))}
          </Cells>
        </div>
      </div>

      {after}

      {/* 2. 세부 지표 — 실선으로 나눈 세 열 */}
      <Section title="세부 지표" meta={`측정일 ${fmtDate(snap.date)}`}>
        <div className="panel">
          <div className="columns n3">
            {cats.map(c => (
              <div className="col" key={c.name}>
                <div className="col-head">
                  <h4>{c.name}</h4>
                  <GradeBadge grade={c.res.grade} />
                </div>
                {c.res.breakdown.map(b => (
                  <ScoreBar key={b.label} label={b.label} score={b.score} comment={b.comment} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 3. 훈련 우선순위 · 부상 리스크 */}
      <Section>
        <div className="split even">
          <div className="panel">
            <div className="card-head">
              <h3>훈련 우선순위</h3>
              <span className="meta">분야별 최저 지표</span>
            </div>
            <div className="rows">
              {r.trainingPriorities.map(t => (
                <div className={`row${t.priority === 1 ? " top" : ""}`} key={t.priority}>
                  <span className="row-num">{pad2(t.priority)}</span>
                  <div className="grow">
                    <div className="title">{t.area}</div>
                    <div className="sub">{t.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="card-head">
              <h3>부상 리스크</h3>
              <RiskPill level={r.injuryRisk.level} />
            </div>
            <div className="flex gap16 start">
              <ScoreRing value={r.injuryRisk.score} size={88} stroke={8} tone={riskTone(r.injuryRisk.level)} label="지수" />
              <ul className="risk-factors grow">
                {r.injuryRisk.factors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* 4. 성장방향 피드백 */}
      <Section title="성장방향 피드백">
        <div className="panel">
          {r.growthFeedback.map((g, i) => (
            <Note key={i}>{g}</Note>
          ))}
        </div>
      </Section>
    </>
  );
}
