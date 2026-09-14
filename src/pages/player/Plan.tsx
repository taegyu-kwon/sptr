import React from "react";
import { useStore } from "../../lib/store";
import { LINEUP_SLOTS, currentLineup } from "../../lib/lineup";
import { PageHead, Empty } from "../../components/ui";
import "../../styles/player.css";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

/* ISO 날짜 → { month: "9월", day: "14" } */
const splitDate = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split("-");
  return { month: `${Number(m)}월`, day: String(Number(d)) };
};

export default function PlanPage() {
  const { db, user } = useStore();
  const teamId = user!.teamId;
  const training = db.training.filter(t => t.teamId === teamId);
  const events = db.events.filter(e => e.teamId === teamId).sort((a, b) => a.date.localeCompare(b.date));
  const lineup = currentLineup(db, teamId);
  const nameOf = (id?: string) => db.players.find(p => p.id === id)?.name ?? "-";

  return (
    <>
      <PageHead title="팀 플랜" desc="이번 주 훈련 일정, 예정된 시합, 코칭스태프가 구성한 예상 라인업입니다." />

      <div className="card">
        <h3>주간 훈련 일정</h3>
        <div className="tbl-wrap">
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
                      <td className="name">{t.day}</td>
                      <td>
                        <span className={`pill${t.position === "전체" ? " violet" : ""}`}>{t.position}</span>
                      </td>
                      <td className="dim">{t.time}</td>
                      <td>{t.content}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid cols-2 mt16">
        <div className="card">
          <h3>다가오는 일정 (훈련 · 시합)</h3>
          {events.length === 0 ? (
            <Empty>예정된 일정이 없습니다.</Empty>
          ) : (
            <div className="list">
              {events.map(e => {
                const { month, day } = splitDate(e.date);
                return (
                  <div className="list-row" key={e.id}>
                    <div className="date-block">
                      <span className="m">{month}</span>
                      <span className="d">{day}</span>
                    </div>
                    <div className="grow">
                      <div className="title">{e.title}</div>
                      <div className="sub">{e.place}</div>
                    </div>
                    <div className="right">
                      <span className={`pill ${e.type === "시합" ? "warn" : "info"}`}>{e.type}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h3>예상 라인업</h3>
          <div className="tbl-wrap">
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
                  const me = pid === user?.playerId;
                  return (
                    <tr key={slot} className={me ? "me" : ""}>
                      <td className="dim">{slot}</td>
                      <td className="name">
                        <span className="flex gap8">
                          {nameOf(pid)}
                          {me && <span className="pill brand">나</span>}
                        </span>
                      </td>
                      <td>{p?.position ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
