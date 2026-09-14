import React, { useState } from "react";
import { useStore } from "../../lib/store";
import type { Position } from "../../lib/types";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const POSITIONS: (Position | "전체")[] = ["전체", "투수", "포수", "내야수", "외야수"];

export default function TrainingPage() {
  const { db, user, setDB } = useStore();
  const teamId = user!.teamId;
  const [posFilter, setPosFilter] = useState<string>("전체");

  const [day, setDay] = useState("월");
  const [position, setPosition] = useState<Position | "전체">("전체");
  const [time, setTime] = useState("16:00-18:00");
  const [content, setContent] = useState("");

  const slots = db.training.filter(
    t => t.teamId === teamId && (posFilter === "전체" || t.position === posFilter || t.position === "전체")
  );

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setDB(prev => ({
      ...prev,
      training: [
        ...prev.training,
        { id: `tr-${Date.now()}`, teamId, day, position, time, content: content.trim() },
      ],
    }));
    setContent("");
  };

  const remove = (id: string) => {
    setDB(prev => ({ ...prev, training: prev.training.filter(t => t.id !== id) }));
  };

  return (
    <>
      <h1 className="page-title">포지션 별 훈련 일정</h1>
      <p className="page-desc">포지션별 주간 훈련 일정을 관리합니다. 선수/학부모 팀 플랜 페이지에 공개됩니다.</p>

      <div className="tabs">
        {POSITIONS.map(pos => (
          <button key={pos} className={posFilter === pos ? "on" : ""} onClick={() => setPosFilter(pos)}>
            {pos}
          </button>
        ))}
      </div>

      <div className="card">
        <h3>주간 일정{posFilter !== "전체" && ` — ${posFilter} (전체 훈련 포함)`}</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>요일</th>
              <th>대상</th>
              <th>시간</th>
              <th>내용</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {DAYS.flatMap(d =>
              slots
                .filter(t => t.day === d)
                .map(t => (
                  <tr key={t.id}>
                    <td><b>{t.day}</b></td>
                    <td><span className={`pill ${t.position === "전체" ? "violet" : "info"}`}>{t.position}</span></td>
                    <td>{t.time}</td>
                    <td>{t.content}</td>
                    <td className="num">
                      <button className="btn ghost sm" onClick={() => remove(t.id)}>삭제</button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card mt16">
        <h3>일정 추가</h3>
        <form onSubmit={add}>
          <div className="form-grid">
            <div className="field">
              <label>요일</label>
              <select value={day} onChange={e => setDay(e.target.value)}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="field">
              <label>대상 포지션</label>
              <select value={position} onChange={e => setPosition(e.target.value as Position | "전체")}>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label>시간</label>
              <input value={time} onChange={e => setTime(e.target.value)} placeholder="16:00-18:00" required />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>훈련 내용</label>
              <input value={content} onChange={e => setContent(e.target.value)} placeholder="예: 불펜 세션 + 하체 웨이트" required />
            </div>
          </div>
          <button className="btn mt16" type="submit">일정 추가</button>
        </form>
      </div>
    </>
  );
}
