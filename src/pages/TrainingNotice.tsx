import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import {
  GROUPS, addDays, dowOf, fmtDate, fromISO, groupOf, hasRead, markNoticeRead, readBeforeEdit, todayISO, uid, useSchedule, visibleIn, weekStart,
  type DailyNotice, type Group, type NoticeItem,
} from "../lib/schedule";
import { Empty, Note, Notice, PageHead, Section, Seg } from "../components/ui";
import { Icon } from "../components/icons";
import "../styles/schedule.css";

export const groupTone: Record<Group, string> = { 전체: "violet", 투수조: "info", 야수조: "good" };
const viewLabel: Record<Group, string> = { 전체: "팀 전체", 투수조: "투수조", 야수조: "야수조" };

const byTime = (a: NoticeItem, b: NoticeItem) => (a.start + a.end).localeCompare(b.start + b.end);

/** 팀 전체 보기: 같은 시간에 투수조·야수조가 따로 하는 훈련은 나란히 놓는다 */
type Row = { kind: "all"; item: NoticeItem } | { kind: "split"; start: string; p: NoticeItem[]; f: NoticeItem[] };
function toRows(items: NoticeItem[]): Row[] {
  const rows: Row[] = [];
  for (const it of [...items].sort(byTime)) {
    if (it.group === "전체") {
      rows.push({ kind: "all", item: it });
      continue;
    }
    const last = rows[rows.length - 1];
    if (last && last.kind === "split" && last.start === it.start) {
      (it.group === "투수조" ? last.p : last.f).push(it);
    } else {
      rows.push({ kind: "split", start: it.start, p: it.group === "투수조" ? [it] : [], f: it.group === "야수조" ? [it] : [] });
    }
  }
  return rows;
}

function relLabel(date: string, today: string) {
  const n = Math.round((fromISO(date).getTime() - fromISO(today).getTime()) / 86400000);
  return n === 0 ? "오늘" : n === 1 ? "내일" : n === -1 ? "어제" : null;
}

export default function TrainingNoticePage() {
  const { db, user } = useStore();
  const teamId = user!.teamId;
  const isCoach = user!.role === "coach";
  const base = isCoach ? "/c" : "/p";
  const me = db.players.find(p => p.id === user!.playerId);
  const myGroup = me ? groupOf(me.position) : null;

  const { notices, games, update } = useSchedule(teamId);
  const today = todayISO();
  const [params, setParams] = useSearchParams();
  const date = params.get("date") ?? today;
  const setDate = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true });
  const [view, setView] = useState<Group>(myGroup ?? "전체");

  const notice = notices.find(n => n.date === date);
  const dayGames = games.filter(g => g.date === date);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i));
  const rel = relLabel(date, today);

  const items = (notice?.items ?? []).filter(it => visibleIn(it, view)).sort(byTime);

  const save = (next: DailyNotice) =>
    update(prev => ({
      ...prev,
      notices: [
        ...prev.notices.filter(n => !(n.teamId === teamId && n.date === next.date)),
        { ...next, teamId, author: user!.name, updatedAt: new Date().toISOString() },
      ],
    }));
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const removeItem = (id: string) => {
    if (!notice) return;
    save({ ...notice, items: notice.items.filter(i => i.id !== id) });
    if (editItemId === id) setEditItemId(null);
  };
  const editItem = notice?.items.find(i => i.id === editItemId);
  const cardProps = isCoach ? { onRemove: removeItem, onEdit: setEditItemId, editingId: editItemId } : {};

  // 선수가 그날 공지를 열면 읽음 기록을 남긴다(공지가 수정되면 다시 열 때 새로 남는다)
  const myId = !isCoach ? me?.id : undefined;
  const iRead = !!(notice && myId && hasRead(notice, myId));
  useEffect(() => {
    if (!myId || !notice || iRead) return;
    update(markNoticeRead(teamId, notice.date, myId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, notice?.id, notice?.updatedAt, iRead]);

  // 코치 화면: 확인한 선수 / 아직 안 본 선수
  const roster = db.players
    .filter(p => p.teamId === teamId)
    .sort((a, b) => b.grade - a.grade || a.backNumber - b.backNumber);
  const readN = notice ? roster.filter(p => hasRead(notice, p.id)).length : 0;
  const unread = notice ? roster.filter(p => !hasRead(notice, p.id)) : [];

  return (
    <>
      <PageHead
        title="훈련 공지"
        desc={
          isCoach
            ? "날짜별 훈련 계획을 올리면 선수·학부모가 훈련 전에 미리 확인합니다. 투수조·야수조를 나눠 쓸 수 있습니다."
            : "오늘 무슨 훈련을 하는지 훈련 전에 미리 확인하세요."
        }
        actions={
          <Link className="btn secondary sm" to={`${base}/calendar`}>
            <Icon.Calendar />
            월간 일정
          </Link>
        }
      />

      {/* 주간 날짜 줄 */}
      <div className="wk-strip-wrap">
        <button className="icon-btn" aria-label="지난주" onClick={() => setDate(addDays(date, -7))}>
          <Icon.ArrowLeft />
        </button>
        <div className="wk-strip" role="tablist" aria-label="날짜 선택">
          {week.map(d => {
            const n = notices.find(x => x.date === d);
            const g = games.find(x => x.date === d);
            return (
              <button
                key={d}
                role="tab"
                aria-selected={d === date}
                className={`wk-day${d === date ? " on" : ""}${d === today ? " today" : ""}`}
                onClick={() => setDate(d)}
              >
                <span className="dow">{dowOf(d)}</span>
                <span className="num">{fromISO(d).getDate()}</span>
                <span className="mark">
                  {g ? <i className={g.kind === "정식대회" ? "m-cup" : "m-game"} /> : n ? <i className={n.off ? "m-off" : "m-train"} /> : <i />}
                </span>
              </button>
            );
          })}
        </div>
        <button className="icon-btn flip" aria-label="다음 주" onClick={() => setDate(addDays(date, 7))}>
          <Icon.ArrowLeft />
        </button>
      </div>
      <div className="wk-legend faint xs">
        <span><i className="m-train" />훈련</span>
        <span><i className="m-game" />연습경기</span>
        <span><i className="m-cup" />정식대회</span>
        <span><i className="m-off" />휴식</span>
        {date !== today && (
          <button className="link-btn" onClick={() => setDate(today)}>오늘로</button>
        )}
      </div>

      {/* 공지 머리 */}
      <Section>
        <div className="panel hero notice-head">
          <div className="flex between wrap">
            <div>
              <div className="eyebrow brand">{rel ? `${rel} 훈련` : "훈련 공지"}</div>
              <h2 className="notice-date">{fmtDate(date)}</h2>
            </div>
            {notice && !notice.off && <span className="pill outline">{notice.author} · {updatedLabel(notice.updatedAt)}</span>}
          </div>

          {dayGames.map(g => (
            <Notice key={g.id} kind={g.kind === "정식대회" ? "warn" : "info"} className="mt12">
              <b>{g.kind}{g.round ? ` · ${g.round}` : ""}</b> vs {[g.opponent, g.time, g.place].filter(Boolean).join(" · ")}
            </Notice>
          ))}

          {!notice ? (
            <div className="mt16">
              <Empty>
                {isCoach ? "이 날짜에는 아직 공지가 없습니다. 아래에서 작성하세요." : "아직 이 날짜의 훈련 공지가 올라오지 않았습니다."}
              </Empty>
            </div>
          ) : notice.off ? (
            <div className="off-day">
              <b>휴식일</b>
              {notice.message && <p>{notice.message}</p>}
            </div>
          ) : (
            <>
              <div className="notice-facts">
                <div><span className="label">집합</span><b>{notice.meetTime || "-"}</b></div>
                <div><span className="label">장소</span><b>{notice.place || "-"}</b></div>
                <div className="wide"><span className="label">준비물 · 복장</span><b>{notice.bring || "-"}</b></div>
              </div>
              {notice.message && <Note className="mt16"><b>전달 사항</b> {notice.message}</Note>}
            </>
          )}

          {notice && !isCoach && iRead && (
            <p className="xs faint read-me"><Icon.Check /> 확인했습니다 · 코칭스태프 화면에 읽음으로 표시됩니다</p>
          )}

          {notice && isCoach && roster.length > 0 && (
            <div className="read-box">
              <div className="read-head">
                <span className="label">선수 확인</span>
                <b>확인 {readN}/{roster.length}명</b>
                <div className="read-bar" aria-hidden="true"><i style={{ width: `${Math.round((readN / roster.length) * 100)}%` }} /></div>
              </div>
              {unread.length === 0 ? (
                <p className="xs faint">모든 선수가 확인했습니다.</p>
              ) : (
                <div className="read-names">
                  <span className="xs faint">미확인 {unread.length}명</span>
                  {unread.map(p => (
                    <span key={p.id} className="pill outline" title={readBeforeEdit(notice, p.id) ? "공지 수정 전에 확인함" : undefined}>
                      {p.name}{readBeforeEdit(notice, p.id) && <small> · 수정 전 확인</small>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* 훈련 시간표 */}
      {notice && !notice.off && (
        <Section
          title="훈련 시간표"
          meta={view === "전체" ? `전체 ${notice.items.length}개` : `${viewLabel[view]} ${items.length}개 · 팀 전체 훈련 포함`}
          actions={
            <Seg
              small
              value={view}
              onChange={setView}
              options={GROUPS.map(g => ({ value: g, label: g === myGroup ? `${viewLabel[g]} (내 조)` : viewLabel[g] }))}
            />
          }
        >
          {items.length === 0 ? (
            <Empty>{viewLabel[view]} 훈련 항목이 없습니다.</Empty>
          ) : view === "전체" ? (
            <div className="tl">
              <div className="tl-lanes hide-mobile">
                <span />
                <span className="tag info">투수조</span>
                <span className="tag good">야수조</span>
              </div>
              {toRows(items).map((r, i) =>
                r.kind === "all" ? (
                  <div className="tl-row" key={r.item.id}>
                    <TimeCol it={r.item} />
                    <div className="tl-all">
                      <ItemCard it={r.item} {...cardProps} />
                    </div>
                  </div>
                ) : (
                  <div className="tl-row" key={`s${i}`}>
                    <TimeCol it={(r.p[0] ?? r.f[0])} />
                    <div className="tl-split">
                      <div className="tl-lane">
                        {r.p.length ? r.p.map(it => <ItemCard key={it.id} it={it} {...cardProps} />) : <div className="tl-none">투수조 별도 훈련 없음</div>}
                      </div>
                      <div className="tl-lane">
                        {r.f.length ? r.f.map(it => <ItemCard key={it.id} it={it} {...cardProps} />) : <div className="tl-none">야수조 별도 훈련 없음</div>}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="tl">
              {items.map(it => (
                <div className="tl-row" key={it.id}>
                  <TimeCol it={it} />
                  <div className="tl-all">
                    <ItemCard it={it} {...cardProps} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {isCoach && (
        <NoticeEditor
          key={`${date}-${notice?.id ?? "new"}`}
          date={date}
          notice={notice}
          notices={notices}
          onSave={save}
          editItem={editItem}
          onDoneEdit={() => setEditItemId(null)}
          onDelete={() =>
            window.confirm(`${fmtDate(date)} 훈련 공지를 삭제할까요?`) &&
            update(prev => ({ ...prev, notices: prev.notices.filter(n => !(n.teamId === teamId && n.date === date)) }))
          }
        />
      )}
    </>
  );
}

function updatedLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} 작성`;
}

function TimeCol({ it }: { it: NoticeItem }) {
  return (
    <div className="tl-time">
      <b>{it.start}</b>
      <span>{it.end}</span>
    </div>
  );
}

function ItemCard({
  it, onRemove, onEdit, editingId,
}: { it: NoticeItem; onRemove?: (id: string) => void; onEdit?: (id: string) => void; editingId?: string | null }) {
  return (
    <div className={`tl-item g-${groupTone[it.group]}${onRemove ? " has-tools" : ""}${editingId === it.id ? " editing" : ""}`}>
      <div className="tl-item-head">
        <span className={`tag ${groupTone[it.group]}`}>{it.group === "전체" ? "팀 전체" : it.group}</span>
        <span className="tl-item-time">{it.start}–{it.end}</span>
      </div>
      <div className="tl-title">{it.title}</div>
      {(it.detail || it.place) && (
        <div className="tl-detail">
          {it.detail}
          {it.place && <span className="faint"> · {it.place}</span>}
        </div>
      )}
      {onEdit && (
        <button type="button" className="icon-btn sm tl-ed" aria-label="항목 수정" title="항목 수정" onClick={() => onEdit(it.id)}>
          <Icon.PenLine />
        </button>
      )}
      {onRemove && (
        <button type="button" className="icon-btn sm danger tl-rm" aria-label="항목 삭제" title="항목 삭제" onClick={() => onRemove(it.id)}>
          <Icon.Trash />
        </button>
      )}
    </div>
  );
}

/* ---------- 코칭스태프 편집 ---------- */

function NoticeEditor({
  date, notice, notices, onSave, onDelete, editItem, onDoneEdit,
}: {
  date: string;
  notice?: DailyNotice;
  notices: DailyNotice[];
  onSave: (n: DailyNotice) => void;
  onDelete: () => void;
  /** 수정 중인 훈련 항목 — 있으면 항목 폼이 수정 상태가 된다 */
  editItem?: NoticeItem;
  onDoneEdit: () => void;
}) {
  const blank: DailyNotice = {
    id: uid("nt"), teamId: "", date, off: false, meetTime: "15:40", place: "학교 운동장", bring: "운동복, 글러브", message: "",
    items: [], author: "", updatedAt: "",
  };
  const [draft, setDraft] = useState<DailyNotice>(notice ?? blank);
  const [saved, setSaved] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editItem) itemRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editItem?.id]);

  // 복사할 공지: 지난주 같은 요일, 없으면 가장 최근 공지
  const copySrc =
    notices.find(n => n.date === addDays(date, -7) && !n.off) ??
    [...notices].filter(n => n.date < date && !n.off).sort((a, b) => b.date.localeCompare(a.date))[0];

  const set = <K extends keyof DailyNotice>(k: K, v: DailyNotice[K]) => {
    setDraft(d => ({ ...d, [k]: v }));
    setSaved(false);
  };

  if (!notice) {
    return (
      <Section title="공지 작성">
        <div className="panel">
          <p className="small faint mt0">{fmtDate(date)} 공지를 새로 만들거나, 지난 공지를 복사해서 고칠 수 있습니다.</p>
          <div className="flex wrap">
            <button className="btn" onClick={() => onSave(blank)}>
              <Icon.Plus />
              새 공지 작성
            </button>
            {copySrc && (
              <button
                className="btn secondary"
                onClick={() =>
                  onSave({
                    ...copySrc,
                    id: uid("nt"),
                    date,
                    items: copySrc.items.map(i => ({ ...i, id: uid("ni") })),
                  })
                }
              >
                <Icon.Refresh />
                {fmtDate(copySrc.date)} 공지 복사
              </button>
            )}
            <button className="btn ghost" onClick={() => onSave({ ...blank, off: true, message: "휴식일입니다." })}>
              휴식일로 공지
            </button>
          </div>
        </div>
      </Section>
    );
  }

  // 기본 안내 폼에서 아직 저장하지 않은 내용은 건드리지 않고 항목만 바꾼다
  const saveItem = (it: NoticeItem) => {
    onSave({
      ...notice,
      items: notice.items.some(x => x.id === it.id) ? notice.items.map(x => (x.id === it.id ? it : x)) : [...notice.items, it],
    });
    if (editItem) onDoneEdit();
  };

  return (
    <Section title="공지 편집" meta="저장하면 선수·학부모 화면에 바로 보입니다">
      <div className="split even">
        <div className="panel">
          <div className="card-head"><h3>기본 안내</h3></div>
          <form
            onSubmit={e => {
              e.preventDefault();
              onSave({ ...draft, items: notice.items, reads: notice.reads });
              setSaved(true);
            }}
          >
            <label className="check-row">
              <input type="checkbox" checked={draft.off} onChange={e => set("off", e.target.checked)} />
              휴식일 (훈련 없음)
            </label>
            {!draft.off && (
              <div className="form-grid cols-2 mt12">
                <div className="field">
                  <label>집합 시간</label>
                  <input type="time" value={draft.meetTime} onChange={e => set("meetTime", e.target.value)} />
                </div>
                <div className="field">
                  <label>장소</label>
                  <input value={draft.place} onChange={e => set("place", e.target.value)} placeholder="학교 운동장" />
                </div>
                <div className="field span-all">
                  <label>준비물 · 복장</label>
                  <input value={draft.bring} onChange={e => set("bring", e.target.value)} placeholder="운동복, 글러브, 러닝화" />
                </div>
              </div>
            )}
            <div className="field mt12">
              <label>전달 사항</label>
              <textarea rows={3} value={draft.message} onChange={e => set("message", e.target.value)} placeholder="선수들에게 미리 알릴 내용" />
            </div>
            <div className="flex wrap mt16">
              <button className="btn" type="submit"><Icon.Check />공지 저장</button>
              <button type="button" className="btn ghost danger" onClick={onDelete}><Icon.Trash />공지 삭제</button>
              {saved && <span className="ok-box">저장했습니다</span>}
            </div>
          </form>
        </div>

        {!notice.off && (
          <div className={`panel${editItem ? " editing" : ""}`} ref={itemRef}>
            <ItemForm key={editItem?.id ?? "new"} edit={editItem} onSubmit={saveItem} onCancel={onDoneEdit} />
          </div>
        )}
      </div>
    </Section>
  );
}

/** 훈련 항목 추가·수정 폼 — 수정할 항목이 바뀌면 key로 새로 만든다 */
function ItemForm({ edit, onSubmit, onCancel }: { edit?: NoticeItem; onSubmit: (it: NoticeItem) => void; onCancel: () => void }) {
  const [start, setStart] = useState(edit?.start ?? "16:00");
  const [end, setEnd] = useState(edit?.end ?? "17:00");
  const [group, setGroup] = useState<Group>(edit?.group ?? "전체");
  const [title, setTitle] = useState(edit?.title ?? "");
  const [detail, setDetail] = useState(edit?.detail ?? "");
  const [err, setErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (end <= start) {
      setErr("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }
    setErr("");
    onSubmit({ ...edit, id: edit?.id ?? uid("ni"), start, end, group, title: title.trim(), detail: detail.trim() || undefined });
    // 다음 항목을 바로 이어서 입력할 수 있게 비운다
    setTitle("");
    setDetail("");
  };

  return (
    <>
      <div className="card-head">
        <h3>{edit ? "훈련 항목 수정" : "훈련 항목 추가"}</h3>
        {edit && <span className="meta">{edit.start}–{edit.end} {edit.title}</span>}
      </div>
      <form onSubmit={submit}>
        <div className="field">
          <label>대상</label>
          <Seg value={group} onChange={setGroup} options={GROUPS.map(g => ({ value: g, label: viewLabel[g] }))} />
        </div>
        <div className="form-grid cols-2 mt12">
          <div className="field">
            <label htmlFor="ni-start">시작</label>
            <input id="ni-start" type="time" value={start} onChange={e => setStart(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="ni-end">종료</label>
            <input id="ni-end" type="time" value={end} onChange={e => setEnd(e.target.value)} required />
          </div>
          <div className="field span-all">
            <label htmlFor="ni-title">훈련 내용</label>
            <input id="ni-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 불펜 세션" required />
          </div>
          <div className="field span-all">
            <label htmlFor="ni-detail">세부 내용 (선택)</label>
            <input id="ni-detail" value={detail} onChange={e => setDetail(e.target.value)} placeholder="예: 존 4분할 타겟 30구" />
          </div>
        </div>
        <p className="xs faint">투수조·야수조가 같은 시작 시간이면 팀 전체 보기에서 나란히 보입니다.</p>
        {err && <Notice kind="error" className="mt12">{err}</Notice>}
        <div className="flex gap8 wrap mt12">
          <button className="btn" type="submit">{edit ? <><Icon.Check />수정 저장</> : <><Icon.Plus />항목 추가</>}</button>
          {edit && <button className="btn ghost" type="button" onClick={onCancel}>취소</button>}
        </div>
      </form>
    </>
  );
}
