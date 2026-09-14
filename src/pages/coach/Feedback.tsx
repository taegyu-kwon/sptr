import React, { useState } from "react";
import { useStore } from "../../lib/store";
import { fmtDate } from "../../lib/format";

export default function CoachFeedbackPage() {
  const { db, user, setDB } = useStore();
  const teamId = user!.teamId;
  const players = db.players.filter(p => p.teamId === teamId);

  const [target, setTarget] = useState<string>("team");
  const [category, setCategory] = useState("훈련");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setDB(prev => ({
      ...prev,
      feedbacks: [
        {
          id: `f-${Date.now()}`,
          teamId,
          playerId: target === "team" ? null : target,
          author: user!.name,
          date: new Date().toISOString().slice(0, 10),
          category,
          content: content.trim(),
        },
        ...prev.feedbacks,
      ],
    }));
    setContent("");
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const list = db.feedbacks
    .filter(f => f.teamId === teamId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const nameOf = (id: string | null) =>
    id === null ? "팀 전체" : players.find(p => p.id === id)?.name ?? "알 수 없음";

  return (
    <>
      <h1 className="page-title">팀 피드백</h1>
      <p className="page-desc">개별 선수 또는 팀 전체에게 피드백을 작성합니다. 선수/학부모 피드백 페이지에 즉시 공개됩니다.</p>

      <div className="card">
        <h3>피드백 작성</h3>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-grid">
            <div className="field">
              <label>대상</label>
              <select value={target} onChange={e => setTarget(e.target.value)}>
                <option value="team">팀 전체</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.position})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>카테고리</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {["훈련", "투구", "타격", "수비", "주루", "컨디셔닝", "멘탈", "팀 전체"].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>내용</label>
            <textarea
              rows={3}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="피드백 내용을 입력하세요"
              required
            />
          </div>
          <div className="flex" style={{ gap: 12 }}>
            <button className="btn" type="submit">피드백 등록</button>
            {saved && <span className="ok-box">등록되었습니다.</span>}
          </div>
        </form>
      </div>

      <div className="card mt16">
        <h3>등록된 피드백 ({list.length})</h3>
        {list.map(f => (
          <div className={`feedback-item${f.playerId === null ? " team" : ""}`} key={f.id}>
            <div className="head">
              <span>
                <span className={`pill ${f.playerId === null ? "violet" : "info"}`}>{nameOf(f.playerId)}</span>{" "}
                <span className="pill info">{f.category}</span> {f.author}
              </span>
              <span>{fmtDate(f.date)}</span>
            </div>
            {f.content}
          </div>
        ))}
      </div>
    </>
  );
}
