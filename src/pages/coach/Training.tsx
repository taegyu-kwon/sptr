import React, { useState } from "react";
import { useStore } from "../../lib/store";
import type { Position } from "../../lib/types";
import { Empty, PageHead, Seg } from "../../components/ui";
import { Icon } from "../../components/icons";

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

  const rows = DAYS.flatMap(d => slots.filter(t => t.day === d));

  return (
    <>
      <PageHead
        title="포지션 별 훈련 일정"
        desc="포지션별 주간 훈련 일정을 관리합니다. 선수/학부모 팀 플랜 페이지에 공개됩니다."
      />

      <div className="toolbar">
        <div className="group">
          <Seg
            small
            value={posFilter}
            onChange={setPosFilter}
            options={POSITIONS.map(pos => ({ value: pos, label: pos }))}
          />
        </div>
      </div>

      <div className="card">
        <h3>주간 일정{posFilter !== "전체" && ` — ${posFilter} (전체 훈련 포함)`}</h3>
        {rows.length === 0 ? (
          <Empty>등록된 일정이 없습니다. 아래에서 일정을 추가하세요.</Empty>
        ) : (
          <div className="tbl-wrap">
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
                {rows.map(t => (
                  <tr key={t.id}>
                    <td className="name">{t.day}</td>
                    <td><span className={`pill${t.position === "전체" ? " violet" : ""}`}>{t.position}</span></td>
                    <td className="dim">{t.time}</td>
                    <td>{t.content}</td>
                    <td className="num">
                      <button type="button" className="icon-btn" aria-label="삭제" title="삭제" onClick={() => remove(t.id)}>
                        <Icon.Trash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>일정 추가</h3>
        </div>
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
            <div className="field span-all">
              <label>훈련 내용</label>
              <input value={content} onChange={e => setContent(e.target.value)} placeholder="예: 불펜 세션 + 하체 웨이트" required />
            </div>
          </div>
          <div className="mt16">
            <button className="btn" type="submit">
              <Icon.Plus />
              일정 추가
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
