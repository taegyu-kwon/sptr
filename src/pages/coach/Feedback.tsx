import React, { useRef, useState } from "react";
import { useStore } from "../../lib/store";
import { fmtDate } from "../../lib/format";
import { todayISO } from "../../lib/schedule";
import { Avatar, Empty, Notice, PageHead } from "../../components/ui";
import { Icon } from "../../components/icons";
import "../../styles/coach.css";

const CATEGORIES = ["훈련", "투구", "타격", "수비", "주루", "컨디셔닝", "멘탈", "팀 전체"];

export default function CoachFeedbackPage() {
  const { db, user, setDB } = useStore();
  const teamId = user!.teamId;
  const players = db.players
    .filter(p => p.teamId === teamId)
    .sort((a, b) => b.grade - a.grade || a.backNumber - b.backNumber);

  const [target, setTarget] = useState<string>("team");
  const [category, setCategory] = useState("훈련");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState("");
  /** 수정 중인 피드백 id (없으면 새로 등록) */
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  /** 목록 필터 — "all" | "team" | 선수 id */
  const [fTarget, setFTarget] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const formRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const flash = (msg: string) => {
    setSaved(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(""), 3000);
  };

  const resetForm = () => {
    setEditId(null);
    setContent("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const playerId = target === "team" ? null : target;
    if (editId) {
      // 작성자·작성일은 그대로 두고 대상·카테고리·내용만 바꾼다
      setDB(prev => ({
        ...prev,
        feedbacks: prev.feedbacks.map(f =>
          f.id === editId ? { ...f, playerId, category, content: content.trim(), updatedAt: new Date().toISOString() } : f
        ),
      }));
      flash("수정했습니다. 선수 화면에도 바로 반영됩니다.");
    } else {
      setDB(prev => ({
        ...prev,
        feedbacks: [
          {
            id: `f-${Date.now()}`,
            teamId,
            playerId,
            author: user!.name,
            date: todayISO(),
            category,
            content: content.trim(),
          },
          ...prev.feedbacks,
        ],
      }));
      flash("등록되었습니다.");
    }
    resetForm();
  };

  const startEdit = (id: string) => {
    const f = db.feedbacks.find(x => x.id === id);
    if (!f) return;
    setEditId(id);
    setTarget(f.playerId ?? "team");
    setCategory(f.category);
    setContent(f.content);
    setConfirmId(null);
    setSaved("");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const remove = (id: string) => {
    setDB(prev => ({ ...prev, feedbacks: prev.feedbacks.filter(f => f.id !== id) }));
    setConfirmId(null);
    if (editId === id) resetForm();
  };

  const all = db.feedbacks
    .filter(f => f.teamId === teamId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const list = all.filter(
    f =>
      (fTarget === "all" || (fTarget === "team" ? f.playerId === null : f.playerId === fTarget)) &&
      (fCategory === "all" || f.category === fCategory)
  );
  const filtered = fTarget !== "all" || fCategory !== "all";
  // 필터 목록에는 피드백이 실제로 있는 선수·카테고리만 넣는다
  const targetIds = new Set(all.map(f => f.playerId));
  const usedCategories = [...new Set([...CATEGORIES.filter(c => all.some(f => f.category === c)), ...all.map(f => f.category)])];
  // 예전 저장본에 목록에 없는 카테고리가 있어도 수정 폼에서 그대로 고를 수 있게 한다
  const categoryOptions = CATEGORIES.includes(category) ? CATEGORIES : [...CATEGORIES, category];

  const nameOf = (id: string | null) =>
    id === null ? "팀 전체" : players.find(p => p.id === id)?.name ?? "알 수 없음";

  return (
    <>
      <PageHead
        title="코칭 피드백"
        desc="개별 선수 또는 팀 전체에게 피드백을 작성합니다. 선수/학부모 피드백 페이지에 즉시 공개됩니다."
      />

      <div className="split">
        <div className={`panel fb-form${editId ? " editing" : ""}`} ref={formRef}>
          <div className="card-head">
            <h3>{editId ? "피드백 수정" : "피드백 작성"}</h3>
            {editId && <span className="meta">작성일은 그대로 유지됩니다</span>}
          </div>
          <form onSubmit={submit}>
            <div className="form-grid cols-1">
              <div className="field">
                <label htmlFor="fb-target">대상</label>
                <select id="fb-target" value={target} onChange={e => setTarget(e.target.value)}>
                  <option value="team">팀 전체</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>#{p.backNumber} {p.name} ({p.grade}학년 · {p.position})</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="fb-category">카테고리</label>
                <select id="fb-category" value={category} onChange={e => setCategory(e.target.value)}>
                  {categoryOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="fb-content">내용</label>
                <textarea
                  id="fb-content"
                  rows={4}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="피드백 내용을 입력하세요"
                  required
                />
              </div>
            </div>
            <div className="flex gap12 wrap mt16">
              <button className="btn" type="submit">{editId ? "수정 저장" : "피드백 등록"}</button>
              {editId && <button className="btn ghost" type="button" onClick={resetForm}>취소</button>}
            </div>
            {saved && <Notice kind="ok" className="mt12">{saved}</Notice>}
          </form>
        </div>

        <div className="panel">
          <div className="card-head">
            <h3>등록된 피드백</h3>
            <span className="meta">{filtered ? `${list.length}건 / 전체 ${all.length}건` : `${all.length}건`}</span>
          </div>

          {all.length > 0 && (
            <div className="fb-filters">
              <div className="field">
                <label htmlFor="fb-f-target">대상 선수</label>
                <select id="fb-f-target" value={fTarget} onChange={e => setFTarget(e.target.value)}>
                  <option value="all">전체</option>
                  {targetIds.has(null) && <option value="team">팀 전체</option>}
                  {players.filter(p => targetIds.has(p.id)).map(p => (
                    <option key={p.id} value={p.id}>#{p.backNumber} {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="fb-f-category">카테고리</label>
                <select id="fb-f-category" value={fCategory} onChange={e => setFCategory(e.target.value)}>
                  <option value="all">전체</option>
                  {usedCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {filtered && (
                <button type="button" className="link-btn" onClick={() => { setFTarget("all"); setFCategory("all"); }}>
                  필터 해제
                </button>
              )}
            </div>
          )}

          {all.length === 0 ? (
            <Empty>아직 등록된 피드백이 없습니다.</Empty>
          ) : list.length === 0 ? (
            <Empty>조건에 맞는 피드백이 없습니다.</Empty>
          ) : (
            <div className="feed">
              {list.map(f => {
                const isTeam = f.playerId === null;
                return (
                  <div className={`feed-item fb-item${editId === f.id ? " editing" : ""}`} key={f.id}>
                    <Avatar name={f.author} tone={isTeam ? "violet" : "brand"} />
                    <div className="fb-main">
                      <div className="feed-meta">
                        <b>{f.author}</b>
                        <span className={`pill${isTeam ? " violet" : ""}`}>{nameOf(f.playerId)}</span>
                        {/* 대상이 팀 전체이고 카테고리도 '팀 전체'면 배지를 한 번만 보여 준다 */}
                        {!(isTeam && f.category === "팀 전체") && <span className="pill outline">{f.category}</span>}
                        <span className="date">{fmtDate(f.date)}{f.updatedAt ? " · 수정됨" : ""}</span>
                      </div>
                      <div className="feed-body">{f.content}</div>
                      <div className="fb-tools">
                        {confirmId === f.id ? (
                          <>
                            <span className="faint small">삭제하면 선수 화면에서도 사라집니다.</span>
                            <button type="button" className="btn sm danger" onClick={() => remove(f.id)}>삭제</button>
                            <button type="button" className="btn ghost sm" onClick={() => setConfirmId(null)}>취소</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="icon-btn sm" aria-label="피드백 수정" title="피드백 수정" onClick={() => startEdit(f.id)}>
                              <Icon.PenLine />
                            </button>
                            <button type="button" className="icon-btn sm danger" aria-label="피드백 삭제" title="피드백 삭제" onClick={() => setConfirmId(f.id)}>
                              <Icon.Trash />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
