import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import {
  GROUPS, addDays, addMonths, dday, daysBetween, fmtDate, fmtShort, fromISO, monthOf, patchGame, patchTournament, todayISO, uid, useSchedule,
  type Direction, type GameKind, type Group, type ScheduledGame, type Tournament,
} from "../lib/schedule";
import { Empty, PageHead, Section, Seg } from "../components/ui";
import { Icon } from "../components/icons";
import { groupTone } from "./TrainingNotice";
import type { GameRecord } from "../lib/types";
import "../styles/schedule.css";

type Filter = "전체" | GameKind;
const CAL_DOW = ["일", "월", "화", "수", "목", "금", "토"];
const kindTone = (k: GameKind) => (k === "정식대회" ? "warn" : "info");
const monthLabel = (m: string) => `${m.slice(0, 4)}년 ${Number(m.slice(5, 7))}월`;
/** 비어 있는 값은 빼고 " · "로 잇는다 (장소 미입력 시 끝에 점이 남지 않게) */
const joinDot = (...xs: (string | undefined)[]) => xs.filter(x => x && x.trim()).join(" · ");
const cupRange = (t: Tournament) =>
  t.startDate === t.endDate ? fmtShort(t.startDate) : `${fmtShort(t.startDate)}–${fmtShort(t.endDate)}`;

export default function MonthlySchedulePage() {
  const { db, user } = useStore();
  const teamId = user!.teamId;
  const isCoach = user!.role === "coach";
  const base = isCoach ? "/c" : "/p";
  const { games, tournaments, directions, notices, update } = useSchedule(teamId);

  const today = todayISO();
  const [params, setParams] = useSearchParams();
  const month = params.get("m") ?? monthOf(today);
  const setMonth = (m: string) => {
    setParams(m === monthOf(today) ? {} : { m }, { replace: true });
    setSel(m === monthOf(today) ? today : `${m}-01`);
  };
  const [sel, setSel] = useState<string>(month === monthOf(today) ? today : `${month}-01`);
  const [filter, setFilter] = useState<Filter>("전체");

  const shown = games.filter(g => filter === "전체" || g.kind === filter);
  const monthGames = shown.filter(g => monthOf(g.date) === month);
  const tnOf = (iso: string) => tournaments.find(t => iso >= t.startDate && iso <= t.endDate);
  const tnById = (id?: string) => tournaments.find(t => t.id === id);

  // 다음 대회 · 다음 경기
  const nextCup = tournaments.find(t => t.endDate >= today);
  const nextGame = games.find(g => g.date >= today);
  const cupGames = nextCup ? games.filter(g => g.tournamentId === nextCup.id) : [];
  const inCup = nextCup && today >= nextCup.startDate;

  // 달력 칸: 그 달 1일이 있는 주의 일요일부터 6주
  const first = `${month}-01`;
  const gridStart = addDays(first, -fromISO(first).getDay());
  const lastDay = addDays(`${addMonths(month, 1)}-01`, -1);
  const weeks = Math.ceil((daysBetween(gridStart, lastDay) + 1) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));

  const dir = directions.find(d => d.month === month);
  const selGames = shown.filter(g => g.date === sel);
  const selNotice = notices.find(n => n.date === sel);
  const selCup = tnOf(sel);

  /** 예정 경기 id → "결과 입력"으로 등록된 시합 기록 */
  const resultOf = (sgId: string) => db.games.find(r => r.teamId === teamId && r.scheduledGameId === sgId);
  /** 수정 중인 예정 경기·대회 (아래 '일정 추가' 폼에 채워진다) */
  const [editGame, setEditGame] = useState<ScheduledGame | null>(null);
  const [editCup, setEditCup] = useState<Tournament | null>(null);
  const rowProps = (g: ScheduledGame) => ({
    g, tn: tnById(g.tournamentId), today, base, result: resultOf(g.id), isCoach,
    onRemove: isCoach ? removeGame : undefined,
    onEdit: isCoach ? (x: ScheduledGame) => { setEditCup(null); setEditGame(x); } : undefined,
  });

  const removeGame = (id: string) => {
    const g = games.find(x => x.id === id);
    if (g && !window.confirm(`${fmtDate(g.date)} vs ${g.opponent} 경기를 일정에서 삭제할까요?`)) return;
    update(p => ({ ...p, games: p.games.filter(x => x.id !== id) }));
    if (editGame?.id === id) setEditGame(null);
  };
  const saveDir = (d: Direction) =>
    update(p => ({ ...p, directions: [...p.directions.filter(x => !(x.teamId === teamId && x.month === d.month)), d] }));

  const practiceN = games.filter(g => monthOf(g.date) === month && g.kind === "연습경기").length;
  const officialN = games.filter(g => monthOf(g.date) === month && g.kind === "정식대회").length;

  return (
    <>
      <PageHead
        title="월간 일정"
        desc="언제 어느 팀과 시합하는지, 다음 대회가 언제인지, 이달 팀 훈련 방향을 한눈에 확인합니다."
        actions={
          <Link className="btn secondary sm" to={`${base}/notice`}>
            <Icon.Timer />
            오늘 훈련 공지
          </Link>
        }
      />

      {/* 요약 */}
      <div className="sch-top">
        <div className="panel tint cup-card">
          <div className="eyebrow brand">{inCup ? "대회 진행 중" : "다음 대회"}</div>
          {nextCup ? (
            <>
              <div className="cup-dday">{inCup ? `${daysBetween(nextCup.startDate, today) + 1}일차` : dday(today, nextCup.startDate)}</div>
              <div className="cup-name">{nextCup.name}</div>
              <div className="sub">
                {joinDot(cupRange(nextCup), nextCup.place)}
              </div>
              {cupGames.length > 0 && (
                <div className="cup-games">
                  {cupGames.map(g => (
                    <span key={g.id} className="pill outline">{fmtShort(g.date)} {g.round} vs {g.opponent}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="faint small">예정된 대회가 없습니다.</p>
          )}
        </div>
        <div className="panel">
          <div className="eyebrow">다음 경기</div>
          {nextGame ? (
            <>
              <div className="cup-dday sm">{dday(today, nextGame.date)}</div>
              <div className="cup-name sm">vs {nextGame.opponent}</div>
              <div className="sub">
                <span className={`pill ${kindTone(nextGame.kind)}`}>{nextGame.kind}</span> {fmtDate(nextGame.date)} {nextGame.time}
              </div>
              <div className="sub">{nextGame.place}</div>
            </>
          ) : (
            <p className="faint small">예정된 경기가 없습니다.</p>
          )}
        </div>
        <div className="panel">
          <div className="eyebrow">{Number(month.slice(5))}월 경기</div>
          <div className="cup-dday sm">{practiceN + officialN}<small>경기</small></div>
          <div className="sub flex wrap gap8">
            <span className="pill info">연습경기 {practiceN}</span>
            <span className="pill warn">정식대회 {officialN}</span>
          </div>
        </div>
      </div>

      {/* 달력 */}
      <Section>
        <div className="toolbar">
          <div className="group">
            <button className="icon-btn" aria-label="이전 달" onClick={() => setMonth(addMonths(month, -1))}><Icon.ArrowLeft /></button>
            <h2 className="cal-title">{monthLabel(month)}</h2>
            <button className="icon-btn flip" aria-label="다음 달" onClick={() => setMonth(addMonths(month, 1))}><Icon.ArrowLeft /></button>
            {month !== monthOf(today) && <button className="link-btn" onClick={() => setMonth(monthOf(today))}>이번 달</button>}
          </div>
          <Seg small value={filter} onChange={setFilter} options={(["전체", "연습경기", "정식대회"] as Filter[]).map(v => ({ value: v, label: v }))} />
        </div>

        <div className="cal">
          {CAL_DOW.map((d, i) => (
            <div key={d} className={`cal-dow${i === 0 ? " sun" : i === 6 ? " sat" : ""}`}>{d}</div>
          ))}
          {cells.map(d => {
            const out = monthOf(d) !== month;
            const gs = shown.filter(g => g.date === d);
            const tn = filter !== "연습경기" ? tnOf(d) : undefined;
            const n = notices.find(x => x.date === d);
            const dow = fromISO(d).getDay();
            return (
              <button
                key={d}
                className={`cal-cell${out ? " out" : ""}${d === today ? " today" : ""}${d === sel ? " sel" : ""}${tn ? " cup" : ""}`}
                onClick={() => setSel(d)}
                aria-label={fmtDate(d)}
              >
                <span className={`cal-num${dow === 0 ? " sun" : dow === 6 ? " sat" : ""}`}>{fromISO(d).getDate()}</span>
                {tn && d === tn.startDate && <span className="cal-cup">{tn.name}</span>}
                {gs.map(g => (
                  <span key={g.id} className={`cal-ev ${kindTone(g.kind)}`}>
                    <i className="dot" />
                    <span className="t">{g.kind === "정식대회" ? "대회" : "연습"} {g.opponent}</span>
                  </span>
                ))}
                {n && !gs.length && <span className={`cal-tr${n.off ? " off" : ""}`}>{n.off ? "휴식" : "훈련"}</span>}
              </button>
            );
          })}
        </div>

        {/* 선택한 날 */}
        <div className="panel sub mt12 sel-day">
          <div className="card-head">
            <h3>{fmtDate(sel)}</h3>
            {selCup && <span className="pill warn">{selCup.name}</span>}
          </div>
          {selGames.length === 0 && !selNotice && <p className="faint small mt0">일정이 없습니다.</p>}
          <div className="rows">
            {selGames.map(g => (
              <GameRow key={g.id} {...rowProps(g)} />
            ))}
          </div>
          {selNotice && (
            <div className="flex between wrap mt12">
              <span className="small muted">
                {selNotice.off ? "휴식일" : `훈련 공지 · 집합 ${selNotice.meetTime} · 항목 ${selNotice.items.length}개`}
              </span>
              <Link className="btn ghost sm" to={`${base}/notice?date=${sel}`}>훈련 공지 보기<Icon.ChevronRight /></Link>
            </div>
          )}
        </div>
      </Section>

      <Section>
        <div className="split even">
          <div className="panel">
            <div className="card-head">
              <h3>{Number(month.slice(5))}월 경기 목록</h3>
              <span className="meta">{monthGames.length}경기</span>
            </div>
            {monthGames.length === 0 ? (
              <Empty>이달 예정된 경기가 없습니다.</Empty>
            ) : (
              <div className="rows">
                {monthGames.map(g => (
                  <GameRow key={g.id} {...rowProps(g)} withDate />
                ))}
              </div>
            )}
          </div>

          <DirectionPanel
            key={month}
            month={month}
            dir={dir}
            teamId={teamId}
            editable={isCoach}
            onSave={saveDir}
          />
        </div>
      </Section>

      {isCoach && (
        <AddForms
          teamId={teamId}
          tournaments={tournaments}
          defaultDate={sel}
          editGame={editGame}
          editCup={editCup}
          onEditCup={t => { setEditGame(null); setEditCup(t); }}
          onCancelEdit={() => { setEditGame(null); setEditCup(null); }}
          onAddGame={g => update(p => ({ ...p, games: [...p.games, g] }))}
          onSaveGame={g => { update(patchGame(g)); setEditGame(null); setSel(g.date); }}
          onAddCup={t => update(p => ({ ...p, tournaments: [...p.tournaments, t] }))}
          onSaveCup={t => { update(patchTournament(t)); setEditCup(null); }}
          onRemoveCup={id => {
            if (!window.confirm(`대회 '${tournaments.find(t => t.id === id)?.name ?? ""}'를 삭제할까요? 대회에 묶인 경기는 일정에 남습니다.`)) return;
            update(p => ({
              ...p,
              tournaments: p.tournaments.filter(t => t.id !== id),
              games: p.games.map(g => (g.tournamentId === id ? { ...g, tournamentId: undefined } : g)),
            }));
            if (editCup?.id === id) setEditCup(null);
          }}
        />
      )}
    </>
  );
}

const resultTone = (r: GameRecord["result"]) => (r === "승" ? "good" : r === "패" ? "bad" : "warn");

function GameRow({
  g, tn, today, base, withDate, result, isCoach, onRemove, onEdit,
}: {
  g: ScheduledGame; tn?: Tournament; today: string; base: string; withDate?: boolean;
  /** 이 예정 경기에 연결된 시합 기록(결과) */
  result?: GameRecord;
  isCoach?: boolean;
  onRemove?: (id: string) => void;
  onEdit?: (g: ScheduledGame) => void;
}) {
  const past = g.date < today;
  // 경기 당일부터 결과를 넣을 수 있다
  const canEnter = isCoach && g.date <= today && !result;
  const enterTo =
    `/c/games?sg=${g.id}&date=${g.date}&opp=${encodeURIComponent(g.opponent)}&type=${g.kind === "정식대회" ? "정식" : "연습"}`;
  return (
    <div className={`row compact game-sched${past && !result && !isCoach ? " past" : ""}`}>
      {withDate && (
        <div className="date-block">
          <span className="m">{CAL_DOW[fromISO(g.date).getDay()]}</span>
          <span className="d">{fromISO(g.date).getDate()}</span>
        </div>
      )}
      <div className="grow">
        <div className="title">vs {g.opponent}</div>
        <div className="sub">
          {joinDot(g.time, g.place, tn ? `${tn.name}${g.round ? ` ${g.round}` : ""}` : "")}
        </div>
      </div>
      <div className="right flex gap8">
        {result && (
          <span className={`pill ${resultTone(result.result)} game-result`} title="시합 기록에 등록된 결과">
            {result.result} {result.scoreFor}:{result.scoreAgainst}
          </span>
        )}
        <span className={`pill ${kindTone(g.kind)}`}>{g.kind}</span>
        {!past && !result && <span className="xs faint">{dday(today, g.date)}</span>}
        {!past && !result && g.kind === "정식대회" && (
          <Link className="btn ghost sm" to={`${base === "/c" ? "/c/lineup" : "/p/plan"}?game=${g.id}`}>라인업<Icon.ChevronRight /></Link>
        )}
        {canEnter && <Link className="btn outline sm" to={enterTo}>결과 입력</Link>}
        {isCoach && result && <Link className="btn ghost sm" to={`/c/games?edit=${result.id}`}>결과 수정</Link>}
        {onEdit && (
          <button className="icon-btn sm" aria-label="경기 수정" title="경기 일정 수정" onClick={() => onEdit(g)}>
            <Icon.PenLine />
          </button>
        )}
        {onRemove && (
          <button className="icon-btn sm danger" aria-label="경기 삭제" title="경기 삭제" onClick={() => onRemove(g.id)}>
            <Icon.Trash />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- 팀 훈련 방향 ---------- */

function DirectionPanel({
  month, dir, teamId, editable, onSave,
}: { month: string; dir?: Direction; teamId: string; editable: boolean; onSave: (d: Direction) => void }) {
  const cur: Direction = dir ?? { teamId, month, theme: "", items: [] };
  const [theme, setTheme] = useState(cur.theme);
  const [text, setText] = useState("");
  const [group, setGroup] = useState<Group>("전체");
  const done = cur.items.filter(i => i.done).length;
  const pct = cur.items.length ? Math.round((done / cur.items.length) * 100) : 0;

  return (
    <div className="panel">
      <div className="card-head">
        <h3>{Number(month.slice(5))}월 팀 훈련 방향</h3>
        {cur.items.length > 0 && <span className="meta">{done}/{cur.items.length} 달성</span>}
      </div>

      {editable ? (
        <div className="field">
          <input
            value={theme}
            onChange={e => setTheme(e.target.value)}
            onBlur={() => theme !== cur.theme && onSave({ ...cur, theme: theme.trim() })}
            placeholder="이달의 훈련 주제 (예: 수비 조직력 강화)"
            aria-label="이달의 훈련 주제"
          />
        </div>
      ) : cur.theme ? (
        <div className="dir-theme">{cur.theme}</div>
      ) : null}

      {cur.items.length > 0 && (
        <div className="dir-progress mt12" aria-label={`달성 ${pct}%`}>
          <i style={{ width: `${pct}%` }} />
        </div>
      )}

      {cur.items.length === 0 ? (
        <div className="mt12"><Empty>{editable ? "아래에서 이달 훈련 목표를 추가하세요." : "아직 정해진 훈련 방향이 없습니다."}</Empty></div>
      ) : (
        <ul className="dir-list">
          {cur.items.map(it => (
            <li key={it.id} className={it.done ? "done" : ""}>
              <label>
                <input
                  type="checkbox"
                  checked={it.done}
                  disabled={!editable}
                  onChange={e =>
                    onSave({ ...cur, items: cur.items.map(x => (x.id === it.id ? { ...x, done: e.target.checked } : x)) })
                  }
                />
                <span className="txt">{it.text}</span>
              </label>
              <span className={`tag ${groupTone[it.group]}`}>{it.group === "전체" ? "팀 전체" : it.group}</span>
              {editable && (
                <button
                  className="icon-btn sm danger"
                  aria-label="목표 삭제"
                  onClick={() => onSave({ ...cur, items: cur.items.filter(x => x.id !== it.id) })}
                >
                  <Icon.Trash />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <form
          className="dir-add"
          onSubmit={e => {
            e.preventDefault();
            if (!text.trim()) return;
            onSave({ ...cur, theme: theme.trim(), items: [...cur.items, { id: uid("dr"), group, text: text.trim(), done: false }] });
            setText("");
          }}
        >
          <select value={group} onChange={e => setGroup(e.target.value as Group)} className="select" aria-label="대상">
            {GROUPS.map(g => <option key={g} value={g}>{g === "전체" ? "팀 전체" : g}</option>)}
          </select>
          <input className="input" value={text} onChange={e => setText(e.target.value)} placeholder="훈련 목표 추가" aria-label="훈련 목표" />
          <button className="btn sm" type="submit"><Icon.Plus />추가</button>
        </form>
      )}
    </div>
  );
}

/* ---------- 경기·대회 추가·수정 (코칭스태프) ---------- */

function AddForms({
  teamId, tournaments, defaultDate, editGame, editCup, onEditCup, onCancelEdit, onAddGame, onSaveGame, onAddCup, onSaveCup, onRemoveCup,
}: {
  teamId: string;
  tournaments: Tournament[];
  defaultDate: string;
  editGame: ScheduledGame | null;
  editCup: Tournament | null;
  onEditCup: (t: Tournament) => void;
  onCancelEdit: () => void;
  onAddGame: (g: ScheduledGame) => void;
  onSaveGame: (g: ScheduledGame) => void;
  onAddCup: (t: Tournament) => void;
  onSaveCup: (t: Tournament) => void;
  onRemoveCup: (id: string) => void;
}) {
  const [msg, setMsg] = useState("");
  const gameRef = useRef<HTMLDivElement>(null);
  const cupRef = useRef<HTMLDivElement>(null);
  // 수정 단추를 누르면 채워진 폼으로 화면을 옮긴다
  useEffect(() => {
    if (editGame) gameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [editGame]);
  useEffect(() => {
    if (editCup) cupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [editCup]);

  return (
    <Section title="일정 추가 · 수정" meta={msg || "선수·학부모는 보기만 할 수 있습니다"}>
      <div className="split even">
        <div className={`panel${editGame ? " editing" : ""}`} ref={gameRef}>
          <GameForm
            key={editGame?.id ?? "new"}
            teamId={teamId}
            tournaments={tournaments}
            defaultDate={defaultDate}
            edit={editGame}
            onCancel={onCancelEdit}
            onSubmit={g => {
              if (editGame) {
                onSaveGame(g);
                setMsg(`${fmtDate(g.date)} vs ${g.opponent} 경기를 수정했습니다.`);
              } else {
                onAddGame(g);
                setMsg(`${fmtDate(g.date)} 경기를 추가했습니다.`);
              }
            }}
          />
        </div>

        <div className={`panel${editCup ? " editing" : ""}`} ref={cupRef}>
          <CupForm
            key={editCup?.id ?? "new"}
            teamId={teamId}
            defaultDate={defaultDate}
            edit={editCup}
            onCancel={onCancelEdit}
            onSubmit={t => {
              if (editCup) {
                onSaveCup(t);
                setMsg(`대회 '${t.name}'를 수정했습니다.`);
              } else {
                onAddCup(t);
                setMsg(`대회 '${t.name}'를 추가했습니다.`);
              }
            }}
          />
          {tournaments.length > 0 && (
            <div className="rows mt20">
              {tournaments.map(t => (
                <div className="row compact" key={t.id}>
                  <div className="grow">
                    <div className="title">{t.name}</div>
                    <div className="sub">{joinDot(cupRange(t), t.place)}</div>
                  </div>
                  <div className="right flex gap8">
                    <button className="icon-btn sm" aria-label="대회 수정" title="대회 수정" onClick={() => onEditCup(t)}>
                      <Icon.PenLine />
                    </button>
                    <button className="icon-btn sm danger" aria-label="대회 삭제" title="대회 삭제" onClick={() => onRemoveCup(t.id)}>
                      <Icon.Trash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function GameForm({
  teamId, tournaments, defaultDate, edit, onSubmit, onCancel,
}: {
  teamId: string;
  tournaments: Tournament[];
  defaultDate: string;
  edit: ScheduledGame | null;
  onSubmit: (g: ScheduledGame) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<GameKind>(edit?.kind ?? "연습경기");
  const [date, setDate] = useState(edit?.date ?? defaultDate);
  const [time, setTime] = useState(edit?.time ?? "10:00");
  const [opponent, setOpponent] = useState(edit?.opponent ?? "");
  const [place, setPlace] = useState(edit?.place ?? "");
  const [tnId, setTnId] = useState(edit?.tournamentId ?? "");
  const [round, setRound] = useState(edit?.round ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponent.trim()) return;
    const tn = tournaments.find(t => t.id === tnId);
    onSubmit({
      id: edit?.id ?? uid("sg"), teamId, date, time, kind, opponent: opponent.trim(), place: place.trim() || tn?.place || "",
      tournamentId: kind === "정식대회" && tn ? tn.id : undefined,
      round: kind === "정식대회" && round.trim() ? round.trim() : undefined,
    });
    if (!edit) {
      setOpponent("");
      setRound("");
    }
  };

  return (
    <>
      <div className="card-head">
        <h3>{edit ? "경기 수정" : "경기 추가"}</h3>
        {edit && <span className="meta">{fmtDate(edit.date)} vs {edit.opponent}</span>}
      </div>
      <form onSubmit={submit}>
        <Seg value={kind} onChange={setKind} options={(["연습경기", "정식대회"] as GameKind[]).map(v => ({ value: v, label: v }))} />
        <div className="form-grid cols-2 mt12">
          <div className="field">
            <label htmlFor="sg-date">날짜</label>
            <input id="sg-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="sg-time">시간</label>
            <input id="sg-time" type="time" value={time} onChange={e => setTime(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="sg-opp">상대 팀</label>
            <input id="sg-opp" value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="예: 분당고" required />
          </div>
          <div className="field">
            <label htmlFor="sg-place">장소</label>
            <input id="sg-place" value={place} onChange={e => setPlace(e.target.value)} placeholder="예: 학교 운동장 (홈)" />
          </div>
          {kind === "정식대회" && (
            <>
              <div className="field">
                <label htmlFor="sg-tn">대회</label>
                <select id="sg-tn" value={tnId} onChange={e => setTnId(e.target.value)}>
                  <option value="">선택 안 함</option>
                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sg-round">라운드</label>
                <input id="sg-round" value={round} onChange={e => setRound(e.target.value)} placeholder="예: 1회전, 8강" />
              </div>
            </>
          )}
        </div>
        <div className="flex gap8 wrap mt16">
          <button className="btn" type="submit">{edit ? <><Icon.Check />수정 저장</> : <><Icon.Plus />경기 추가</>}</button>
          {edit && <button className="btn ghost" type="button" onClick={onCancel}>취소</button>}
        </div>
      </form>
    </>
  );
}

function CupForm({
  teamId, defaultDate, edit, onSubmit, onCancel,
}: {
  teamId: string;
  defaultDate: string;
  edit: Tournament | null;
  onSubmit: (t: Tournament) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(edit?.name ?? "");
  const [start, setStart] = useState(edit?.startDate ?? defaultDate);
  const [end, setEnd] = useState(edit?.endDate ?? defaultDate);
  const [place, setPlace] = useState(edit?.place ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      id: edit?.id ?? uid("tn"), teamId, name: name.trim(), startDate: start, endDate: end < start ? start : end, place: place.trim(),
    });
    if (!edit) setName("");
  };

  return (
    <>
      <div className="card-head">
        <h3>{edit ? "대회 수정" : "대회 추가"}</h3>
        {edit && <span className="meta">{edit.name}</span>}
      </div>
      <form onSubmit={submit}>
        <div className="form-grid cols-2">
          <div className="field span-all">
            <label htmlFor="cup-name">대회 이름</label>
            <input id="cup-name" value={name} onChange={e => setName(e.target.value)} placeholder="예: 경기도 추계 리그" required />
          </div>
          <div className="field">
            <label htmlFor="cup-start">시작일</label>
            <input id="cup-start" type="date" value={start} onChange={e => setStart(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="cup-end">종료일</label>
            <input id="cup-end" type="date" value={end} onChange={e => setEnd(e.target.value)} required />
          </div>
          <div className="field span-all">
            <label htmlFor="cup-place">장소</label>
            <input id="cup-place" value={place} onChange={e => setPlace(e.target.value)} placeholder="예: 수원 야구장" />
          </div>
        </div>
        <div className="flex gap8 wrap mt16">
          <button className="btn" type="submit">{edit ? <><Icon.Check />수정 저장</> : <><Icon.Plus />대회 추가</>}</button>
          {edit && <button className="btn ghost" type="button" onClick={onCancel}>취소</button>}
        </div>
      </form>
    </>
  );
}
