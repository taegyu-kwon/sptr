import React from "react";
import { useStore } from "../../lib/store";
import { LINEUP_SLOTS, currentLineup } from "../../lib/lineup";
import { fmtDate } from "../../lib/format";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

export default function PlanPage() {
  const { db, user } = useStore();
  const teamId = user!.teamId;
  const training = db.training.filter(t => t.teamId === teamId);
  const events = db.events.filter(e => e.teamId === teamId).sort((a, b) => a.date.localeCompare(b.date));
  const lineup = currentLineup(db, teamId);
  const nameOf = (id?: string) => db.players.find(p => p.id === id)?.name ?? "-";

  return (
    <>
      <h1 className="page-title">팀 플랜</h1>
      <p className="page-desc">이번 주 훈련 일정, 예정된 시합, 코칭스태프가 구성한 예상 라인업입니다.</p>

      <div className="card">
        <h3>주간 훈련 일정</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>요일</th>
              <th>대상</th>
              <th>시간</th>
              <th>내용</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.flatMap(day =>
              training
                .filter(t => t.day === day)
                .map(t => (
                  <tr key={t.id}>
                    <td><b>{t.day}</b></td>
                    <td>
                      <span className={`pill ${t.position === "전체" ? "violet" : "info"}`}>{t.position}</span>
                    </td>
                    <td>{t.time}</td>
                    <td>{t.content}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid cols-2 mt16">
        <div className="card">
          <h3>다가오는 일정 (훈련 · 시합)</h3>
          {events.map(e => (
            <div className="feedback-item" key={e.id} style={{ borderLeftColor: e.type === "시합" ? "#d29922" : "#2f81f7" }}>
              <div className="head">
                <span><span className={`pill ${e.type === "시합" ? "warn" : "info"}`}>{e.type}</span></span>
                <span>{fmtDate(e.date)}</span>
              </div>
              <b>{e.title}</b>
              <div className="muted small mt8">장소: {e.place}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>예상 라인업</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>슬롯</th>
                <th>선수</th>
                <th>포지션</th>
              </tr>
            </thead>
            <tbody>
              {LINEUP_SLOTS.map(slot => {
                const pid = lineup[slot];
                const p = db.players.find(x => x.id === pid);
                return (
                  <tr key={slot} className={pid === user?.playerId ? "me" : ""}>
                    <td><b>{slot}</b></td>
                    <td>
                      {nameOf(pid)}
                      {pid === user?.playerId && <span className="pill info" style={{ marginLeft: 8 }}>나</span>}
                    </td>
                    <td>{p?.position ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
