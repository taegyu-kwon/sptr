import React from "react";
import { useStore } from "../../lib/store";
import { fmtDate } from "../../lib/format";

export default function FeedbackPage() {
  const { db, user } = useStore();
  const mine = db.feedbacks
    .filter(f => f.teamId === user?.teamId && f.playerId === user?.playerId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const team = db.feedbacks
    .filter(f => f.teamId === user?.teamId && f.playerId === null)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <h1 className="page-title">코칭스태프 피드백</h1>
      <p className="page-desc">코칭스태프가 남긴 개인 피드백과 팀 전체 피드백입니다.</p>

      <div className="grid cols-2">
        <div className="card">
          <h3>개인 피드백</h3>
          {mine.length === 0 && <div className="muted small">아직 등록된 개인 피드백이 없습니다.</div>}
          {mine.map(f => (
            <div className="feedback-item" key={f.id}>
              <div className="head">
                <span><span className="pill info">{f.category}</span> {f.author}</span>
                <span>{fmtDate(f.date)}</span>
              </div>
              {f.content}
            </div>
          ))}
        </div>
        <div className="card">
          <h3>팀 전체 피드백</h3>
          {team.length === 0 && <div className="muted small">아직 등록된 팀 피드백이 없습니다.</div>}
          {team.map(f => (
            <div className="feedback-item team" key={f.id}>
              <div className="head">
                <span><span className="pill violet">{f.category}</span> {f.author}</span>
                <span>{fmtDate(f.date)}</span>
              </div>
              {f.content}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
