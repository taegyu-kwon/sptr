import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import {
  GROUPS, addDays, addMonths, dday, daysBetween, fmtDate, fmtShort, fromISO, monthOf, todayISO, uid, useSchedule,
  type Direction, type GameKind, type Group, type ScheduledGame, type Tournament,
} from "../lib/schedule";
import { Empty, PageHead, Section, Seg } from "../components/ui";
import { Icon } from "../components/icons";
import { groupTone } from "./TrainingNotice";
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
  const { user } = useStore();
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

  const removeGame = (id: string) => {
    const g = games.find(x => x.id === id);
    if (g && !window.confirm(`${fmtDate(g.date)} vs ${g.opponent} 경기를 일정에서 삭제할까요?`)) return;
    update(p => ({ ...p, games: p.games.filter(x => x.id !== id) }));
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
              <GameRow key={g.id} g={g} tn={tnById(g.tournamentId)} today={today} base={base} onRemove={isCoach ? removeGame : undefined} />
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
                  <GameRow key={g.id} g={g} tn={tnById(g.tournamentId)} today={today} base={base} withDate onRemove={isCoach ? removeGame : undefined} />
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
          onAddGame={g => update(p => ({ ...p, games: [...p.games, g] }))}
          onAddCup={t => update(p => ({ ...p, tournaments: [...p.tournaments, t] }))}
          onRemoveCup={id =>
            window.confirm(`대회 '${tournaments.find(t => t.id === id)?.name ?? ""}'를 삭제할까요? 대회에 묶인 경기는 일정에 남습니다.`) &&
            update(p => ({
              ...p,
              tournaments: p.tournaments.filter(t => t.id !== id),
              games: p.games.map(g => (g.tournamentId === id ? { ...g, tournamentId: undefined } : g)),
            }))
          }
        />
      )}
    </>
  );
}

function GameRow({
  g, tn, today, base, withDate, onRemove,
}: { g: ScheduledGame; tn?: Tournament; today: string; base: string; withDate?: boolean; onRemove?: (id: string) => void }) {
  const past = g.date < today;
  return (
    <div className={`row compact${past ? " past" : ""}`}>
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
        <span className={`pill ${kindTone(g.kind)}`}>{g.kind}</span>
        {!past && <span className="xs faint">{dday(today, g.date)}</span>}
        {!past && g.kind === "정식대회" && (
          <Link className="btn ghost sm" to={`${base === "/c" ? "/c/lineup" : "/p/plan"}?game=${g.id}`}>라인업<Icon.ChevronRight /></Link>
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

/* ---------- 경기·대회 추가 (코칭스태프) ---------- */

function AddForms({
  teamId, tournaments, defaultDate, onAddGame, onAddCup, onRemoveCup,
}: {
  teamId: string;
  tournaments: Tournament[];
  defaultDate: string;
  onAddGame: (g: ScheduledGame) => void;
  onAddCup: (t: Tournament) => void;
  onRemoveCup: (id: string) => void;
}) {
  const [kind, setKind] = useState<GameKind>("연습경기");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("10:00");
  const [opponent, setOpponent] = useState("");
  const [place, setPlace] = useState("");
  const [tnId, setTnId] = useState("");
  const [round, setRound] = useState("");

  const [cName, setCName] = useState("");
  const [cStart, setCStart] = useState(defaultDate);
  const [cEnd, setCEnd] = useState(defaultDate);
  const [cPlace, setCPlace] = useState("");
  const [msg, setMsg] = useState("");

  const addGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponent.trim()) return;
    const tn = tournaments.find(t => t.id === tnId);
    onAddGame({
      id: uid("sg"), teamId, date, time, kind, opponent: opponent.trim(), place: place.trim() || tn?.place || "",
      tournamentId: kind === "정식대회" && tn ? tn.id : undefined,
      round: kind === "정식대회" && round.trim() ? round.trim() : undefined,
    });
    setOpponent("");
    setRound("");
    setMsg(`${fmtDate(date)} 경기를 추가했습니다.`);
  };

  const addCup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim()) return;
    const end = cEnd < cStart ? cStart : cEnd;
    onAddCup({ id: uid("tn"), teamId, name: cName.trim(), startDate: cStart, endDate: end, place: cPlace.trim() });
    setCName("");
    setMsg(`대회 '${cName.trim()}'를 추가했습니다.`);
  };

  return (
    <Section title="일정 추가" meta={msg || "선수·학부모는 보기만 할 수 있습니다"}>
      <div className="split even">
        <div className="panel">
          <div className="card-head"><h3>경기 추가</h3></div>
          <form onSubmit={addGame}>
            <Seg value={kind} onChange={setKind} options={(["연습경기", "정식대회"] as GameKind[]).map(v => ({ value: v, label: v }))} />
            <div className="form-grid cols-2 mt12">
              <div className="field">
                <label>날짜</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="field">
                <label>시간</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} required />
              </div>
              <div className="field">
                <label>상대 팀</label>
                <input value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="예: 분당고" required />
              </div>
              <div className="field">
                <label>장소</label>
                <input value={place} onChange={e => setPlace(e.target.value)} placeholder="예: 학교 운동장 (홈)" />
              </div>
              {kind === "정식대회" && (
                <>
                  <div className="field">
                    <label>대회</label>
                    <select value={tnId} onChange={e => setTnId(e.target.value)}>
                      <option value="">선택 안 함</option>
                      {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>라운드</label>
                    <input value={round} onChange={e => setRound(e.target.value)} placeholder="예: 1회전, 8강" />
                  </div>
                </>
              )}
            </div>
            <button className="btn mt16" type="submit"><Icon.Plus />경기 추가</button>
          </form>
        </div>

        <div className="panel">
          <div className="card-head"><h3>대회 추가</h3></div>
          <form onSubmit={addCup}>
            <div className="form-grid cols-2">
              <div className="field span-all">
                <label>대회 이름</label>
                <input value={cName} onChange={e => setCName(e.target.value)} placeholder="예: 경기도 추계 리그" required />
              </div>
              <div className="field">
                <label>시작일</label>
                <input type="date" value={cStart} onChange={e => setCStart(e.target.value)} required />
              </div>
              <div className="field">
                <label>종료일</label>
                <input type="date" value={cEnd} onChange={e => setCEnd(e.target.value)} required />
              </div>
              <div className="field span-all">
                <label>장소</label>
                <input value={cPlace} onChange={e => setCPlace(e.target.value)} placeholder="예: 수원 야구장" />
              </div>
            </div>
            <button className="btn mt16" type="submit"><Icon.Plus />대회 추가</button>
          </form>
          {tournaments.length > 0 && (
            <div className="rows mt20">
              {tournaments.map(t => (
                <div className="row compact" key={t.id}>
                  <div className="grow">
                    <div className="title">{t.name}</div>
                    <div className="sub">{joinDot(cupRange(t), t.place)}</div>
                  </div>
                  <button className="icon-btn sm danger" aria-label="대회 삭제" title="대회 삭제" onClick={() => onRemoveCup(t.id)}>
                    <Icon.Trash />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
