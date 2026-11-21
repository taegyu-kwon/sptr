import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../../lib/store";
import type { LineupBatter, LineupPos, Player, SavedLineup } from "../../lib/types";
import {
  LINEUP_POSITIONS, checkLineup, defaultLineupOf, gameLineupOf, lineupStrength, pitcherOf, suggestLineup,
} from "../../lib/lineup";
import { dday, fmtDate, fmtShort, todayISO, useSchedule, type ScheduledGame, type Tournament } from "../../lib/schedule";
import { Cell, Cells, Empty, Notice, PageHead, Section, Seg } from "../../components/ui";
import LineupField from "../../components/LineupField";
import "../../styles/coach.css";
import "../../styles/schedule.css";
import "../../styles/lineup.css";

type Draft = Pick<SavedLineup, "useDH" | "order" | "pitcherId" | "memo" | "published">;
const GROUP_ORDER = ["투수", "포수", "내야수", "외야수"] as const;

const toDraft = (l: SavedLineup): Draft => ({
  useDH: l.useDH, order: l.order.map(b => (b ? { ...b } : null)), pitcherId: l.pitcherId, memo: l.memo, published: l.published,
});
const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);
const fmtStamp = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function LineupPage() {
  const { db, user } = useStore();
  const teamId = user!.teamId;
  const { games, tournaments } = useSchedule(teamId);
  const today = todayISO();
  const official = games.filter(g => g.kind === "정식대회" && g.date >= today);

  const [params, setParams] = useSearchParams();
  const gameParam = params.get("game");
  const target = gameParam && official.some(g => g.id === gameParam) ? gameParam : null;
  const pick = (id: string | null) => setParams(id ? { game: id } : {}, { replace: true });

  const game = official.find(g => g.id === target);
  const tn = game ? tournaments.find(t => t.id === game.tournamentId) : undefined;

  return (
    <>
      <PageHead
        title="정식 경기 라인업"
        desc="정식 경기에 나갈 타순과 수비 위치를 미리 짜 둡니다. 기본 라인업은 모든 정식 경기에 쓰이고, 경기마다 전용 라인업으로 바꿀 수 있습니다. 공개하면 선수·학부모가 예상 라인업에서 자기 타순과 포지션을 봅니다."
      />

      <Section>
        <div className="lu-targets" role="tablist" aria-label="라인업 고르기">
          <button type="button" role="tab" aria-selected={!target} className={`lu-target${!target ? " on" : ""}`} onClick={() => pick(null)}>
            <span className="t">기본 라인업</span>
            <span className="s">모든 정식 경기</span>
            <span className={`st${defaultLineupOf(db, teamId) ? " own" : ""}`}>
              {defaultLineupOf(db, teamId) ? (defaultLineupOf(db, teamId)!.published ? "공개 중" : "작성 중") : "아직 없음"}
            </span>
          </button>
          {official.map(g => {
            const own = gameLineupOf(db, teamId, g.id);
            const t = tournaments.find(x => x.id === g.tournamentId);
            return (
              <button key={g.id} type="button" role="tab" aria-selected={target === g.id} className={`lu-target${target === g.id ? " on" : ""}`} onClick={() => pick(g.id)}>
                <span className="t">{fmtShort(g.date)} vs {g.opponent}</span>
                <span className="s">{t ? `${t.name.length > 10 ? t.name.slice(0, 10) + "…" : t.name}` : "정식대회"}{g.round ? ` · ${g.round}` : ""} · {dday(today, g.date)}</span>
                <span className={`st${own ? " own" : ""}`}>{own ? (own.published ? "전용 라인업 · 공개" : "전용 라인업 · 작성 중") : "기본 라인업 사용"}</span>
              </button>
            );
          })}
        </div>
        {official.length === 0 && <p className="small faint mt12">다가오는 정식대회 경기가 없습니다. 월간 일정에서 경기를 추가하면 여기에 나타납니다.</p>}
      </Section>

      <Editor key={target ?? "default"} teamId={teamId} game={game} tn={tn} />
    </>
  );
}

function Editor({ teamId, game, tn }: { teamId: string; game?: ScheduledGame; tn?: Tournament }) {
  const { db, user, setDB } = useStore();
  const players = useMemo(
    () => db.players.filter(p => p.teamId === teamId).sort((a, b) => b.grade - a.grade || a.backNumber - b.backNumber),
    [db.players, teamId]
  );
  const base = defaultLineupOf(db, teamId);
  const own = game ? gameLineupOf(db, teamId, game.id) : base;
  const start: Draft = own
    ? toDraft(own)
    : game && base
      ? { ...toDraft(base), memo: "" }
      : { ...suggestLineup(players, db.games, true), memo: "", published: true };

  const [d, setD] = useState<Draft>(start);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const dirty = !own || !sameDraft(d, toDraft(own));

  const issues = useMemo(() => checkLineup(d, players), [d, players]);
  const errors = issues.filter(i => i.level === "error");
  const strength = useMemo(() => lineupStrength(db, d), [db, d]);
  const byId = (id?: string | null) => players.find(p => p.id === id);
  const spId = pitcherOf(d);
  const inLineup = new Set([...d.order.filter(Boolean).map(b => b!.playerId), ...(spId ? [spId] : [])]);
  const bench = players.filter(p => !inLineup.has(p.id));

  const flash = (m: typeof msg) => {
    setMsg(m);
    if (m?.kind === "ok") setTimeout(() => setMsg(null), 3000);
  };

  /* ---------- 편집 ---------- */

  const setOrder = (fn: (o: (LineupBatter | null)[]) => (LineupBatter | null)[]) => setD(prev => ({ ...prev, order: fn([...prev.order]) }));

  const posTaken = (o: (LineupBatter | null)[], pos: LineupPos, except: number) => o.some((b, k) => k !== except && b?.pos === pos);
  const allowed = (useDH: boolean): LineupPos[] => LINEUP_POSITIONS.filter(p => (useDH ? p !== "투수" : p !== "지명타자"));

  const setPlayer = (i: number, pid: string) =>
    setD(prev => {
      const o = [...prev.order];
      let pitcherId = prev.pitcherId;
      if (!pid) {
        o[i] = null;
        return { ...prev, order: o };
      }
      // 다른 타순·선발 투수 자리에 있던 선수면 그 자리를 비운다
      o.forEach((b, k) => { if (k !== i && b?.playerId === pid) o[k] = null; });
      if (prev.useDH && pitcherId === pid) pitcherId = null;
      const p = byId(pid)!;
      const keep = o[i]?.pos;
      let pos: LineupPos | undefined = keep;
      if (!pos) {
        const own = p.positionDetail as LineupPos | undefined;
        const ok = allowed(prev.useDH);
        pos = own && ok.includes(own) && !posTaken(o, own, i) ? own : ok.find(x => !posTaken(o, x, i)) ?? ok[0];
      }
      o[i] = { playerId: pid, pos };
      return { ...prev, order: o, pitcherId };
    });

  /** 수비 위치 바꾸기 — 이미 그 자리에 다른 타자가 있으면 서로 바꾼다 */
  const setPos = (i: number, pos: LineupPos) =>
    setOrder(o => {
      const cur = o[i];
      if (!cur) return o;
      const j = o.findIndex((b, k) => k !== i && b?.pos === pos);
      if (j >= 0) o[j] = { ...o[j]!, pos: cur.pos };
      o[i] = { ...cur, pos };
      return o;
    });

  /* 타순 바꾸기 — 번호를 끌어 다른 줄에 놓으면 그 자리로 옮기고(사이 타자는 한 칸씩 밀림),
     번호를 하나 누른 뒤 다른 번호를 누르면 두 타자를 맞바꾼다 */
  const [pick, setPick] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; over: number | null } | null>(null);
  const swap = (i: number, j: number) =>
    setOrder(o => {
      [o[i], o[j]] = [o[j], o[i]];
      return o;
    });
  const moveTo = (from: number, to: number) =>
    setOrder(o => {
      const [x] = o.splice(from, 1);
      o.splice(to, 0, x);
      return o;
    });
  const tapNo = (i: number) => {
    if (pick === null) setPick(i);
    else {
      if (pick !== i) swap(pick, i);
      setPick(null);
    }
  };

  /** 지명타자 켜고 끄기 — 투수 타석 ↔ 지명타자 자리를 서로 바꿔 끼운다 */
  const toggleDH = (useDH: boolean) =>
    setD(prev => {
      if (prev.useDH === useDH) return prev;
      const o = [...prev.order];
      if (useDH) {
        const i = o.findIndex(b => b?.pos === "투수");
        const pitcherId = i >= 0 ? o[i]!.playerId : null;
        if (i >= 0) o[i] = null;
        return { ...prev, useDH, order: o, pitcherId };
      }
      const i = o.findIndex(b => b?.pos === "지명타자");
      if (i >= 0) o[i] = prev.pitcherId ? { playerId: prev.pitcherId, pos: "투수" } : null;
      else if (prev.pitcherId) {
        const empty = o.findIndex(b => !b);
        if (empty >= 0) o[empty] = { playerId: prev.pitcherId, pos: "투수" };
      }
      return { ...prev, useDH, order: o, pitcherId: null };
    });

  const setPitcher = (pid: string) =>
    setD(prev => ({ ...prev, pitcherId: pid || null, order: prev.order.map(b => (b?.playerId === pid ? null : b)) }));

  /* ---------- 저장 ---------- */

  const save = () => {
    if (d.published && errors.length) {
      flash({ kind: "error", text: "빠진 자리가 있어 공개할 수 없습니다. 아래 확인 사항을 고치거나 '선수단에 공개'를 끄고 작성 중으로 저장하세요." });
      return;
    }
    const gameId = game?.id ?? null;
    const rec: SavedLineup = {
      id: own?.id ?? `lu-${Date.now().toString(36)}`,
      teamId, gameId, ...d, memo: d.memo.trim(),
      updatedAt: new Date().toISOString(), author: user?.name ?? "",
    };
    setDB(prev => ({ ...prev, lineups: [...prev.lineups.filter(l => !(l.teamId === teamId && l.gameId === gameId)), rec] }));
    flash({ kind: "ok", text: d.published ? "저장했습니다. 선수·학부모 예상 라인업에 바로 보입니다." : "작성 중으로 저장했습니다. 선수에게는 아직 보이지 않습니다." });
  };

  const dropOwn = () => {
    if (!game || !own) return;
    setDB(prev => ({ ...prev, lineups: prev.lineups.filter(l => l.id !== own.id) }));
    setD(base ? { ...toDraft(base), memo: "" } : { ...suggestLineup(players, db.games, d.useDH), memo: "", published: true });
    flash({ kind: "ok", text: "전용 라인업을 지웠습니다. 이 경기는 다시 기본 라인업을 씁니다." });
  };

  const optionLabel = (p: Player) => {
    const where = d.order.findIndex(b => b?.playerId === p.id);
    const tag = where >= 0 ? ` (${where + 1}번)` : d.useDH && d.pitcherId === p.id ? " (선발)" : "";
    return `#${p.backNumber} ${p.name} · ${p.positionDetail ?? p.position} · ${p.grade}학년${tag}`;
  };
  const playerOptions = (pool: Player[]) =>
    GROUP_ORDER.map(g => {
      const xs = pool.filter(p => p.position === g);
      return xs.length ? (
        <optgroup key={g} label={g}>
          {xs.map(p => <option key={p.id} value={p.id}>{optionLabel(p)}</option>)}
        </optgroup>
      ) : null;
    });

  const title = game ? `${fmtDate(game.date)} vs ${game.opponent}` : "정식 경기 기본 라인업";
  const sub = game
    ? [game.time, game.place, tn ? `${tn.name}${game.round ? ` ${game.round}` : ""}` : ""].filter(Boolean).join(" · ")
    : "경기별 전용 라인업이 없는 모든 정식 경기에 쓰입니다.";

  return (
    <>
    <Section>
      <div className="panel">
        <div className="card-head">
          <div>
            <h3>{title}</h3>
            <p className="small muted mt0" style={{ marginTop: 4 }}>{sub}</p>
          </div>
          <div className="actions">
            {own ? (
              <span className={`pill ${own.published ? "good" : "outline"}`}>{own.published ? "공개 중" : "작성 중"} · {fmtStamp(own.updatedAt)}{own.author ? ` ${own.author}` : ""}</span>
            ) : game ? (
              <span className="pill outline">기본 라인업 사용 중</span>
            ) : (
              <span className="pill outline">저장 전</span>
            )}
            {dirty && own && <span className="pill warn">저장 안 된 변경</span>}
          </div>
        </div>

        <div className="flex between wrap gap8" style={{ marginBottom: 14 }}>
          <Seg
            small
            value={d.useDH ? "dh" : "no"}
            onChange={v => toggleDH(v === "dh")}
            options={[{ value: "dh", label: "지명타자 있음" }, { value: "no", label: "지명타자 없음" }]}
          />
          <div className="flex gap8 wrap">
            {game && base && (
              <button type="button" className="btn ghost sm" onClick={() => setD(prev => ({ ...toDraft(base), memo: prev.memo, published: prev.published }))}>
                기본 라인업 불러오기
              </button>
            )}
            <button type="button" className="btn outline sm" onClick={() => setD(prev => ({ ...prev, ...suggestLineup(players, db.games, prev.useDH) }))}>
              추천 자동 배치
            </button>
          </div>
        </div>

        <div className="lu-editor">
          <div>
            <p className="xs faint lu-hint">
              {pick === null
                ? "번호를 끌어 원하는 타순에 놓거나, 번호 두 개를 차례로 눌러 두 타자를 맞바꿉니다."
                : `${pick + 1}번을 골랐습니다. 맞바꿀 타순 번호를 누르세요. (같은 번호를 다시 누르면 취소)`}
            </p>
            <div className="lu-rows" onDragEnd={() => setDrag(null)}>
              {d.order.map((b, i) => {
                const p = byId(b?.playerId);
                const off = p && b && b.pos !== "지명타자" && p.positionDetail && p.positionDetail !== b.pos;
                return (
                  <div
                    key={i}
                    className={`lu-row${b ? " filled" : ""}${pick === i ? " picked" : ""}${pick !== null && pick !== i ? " swappable" : ""}${drag && drag.over === i && drag.from !== i ? " drop" : ""}${drag?.from === i ? " dragging" : ""}`}
                    onDragOver={e => {
                      if (!drag) return;
                      e.preventDefault();
                      if (drag.over !== i) setDrag({ ...drag, over: i });
                    }}
                    onDrop={e => {
                      e.preventDefault();
                      if (drag && drag.from !== i) moveTo(drag.from, i);
                      setDrag(null);
                    }}
                  >
                    {/* 버튼 요소는 크롬에서 끌기가 시작되지 않아 div로 만든다 */}
                    <div
                      role="button"
                      tabIndex={0}
                      className="no grip"
                      draggable
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          tapNo(i);
                        }
                        if (e.key === "Escape") setPick(null);
                      }}
                      onDragStart={e => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(i));
                        setPick(null);
                        setDrag({ from: i, over: null });
                      }}
                      onClick={() => tapNo(i)}
                      aria-pressed={pick === i}
                      aria-label={pick === null ? `${i + 1}번 타순 옮기기` : pick === i ? "선택 취소" : `${pick + 1}번과 ${i + 1}번 맞바꾸기`}
                      title="끌어서 옮기기 · 눌러서 맞바꾸기"
                    >
                      <span className="dots" aria-hidden="true" />
                      {i + 1}
                    </div>
                    <div className="who-sel">
                      <select className="select" value={b?.playerId ?? ""} onChange={e => setPlayer(i, e.target.value)} aria-label={`${i + 1}번 타자`}>
                        <option value="">— 비어 있음 —</option>
                        {playerOptions(players)}
                      </select>
                      {off && <span className="off">주 포지션 {p!.positionDetail}</span>}
                    </div>
                    <select
                      className="select"
                      value={b?.pos ?? ""}
                      disabled={!b}
                      onChange={e => setPos(i, e.target.value as LineupPos)}
                      aria-label={`${i + 1}번 타자 수비 위치`}
                    >
                      {!b && <option value="">수비 위치</option>}
                      {allowed(d.useDH).map(pos => {
                        const j = d.order.findIndex((x, k) => k !== i && x?.pos === pos);
                        return (
                          <option key={pos} value={pos}>
                            {pos}{j >= 0 ? ` (${j + 1}번과 바꾸기)` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                );
              })}
              {d.useDH && (
                <div className={`lu-row sp${d.pitcherId ? " filled" : ""}`}>
                  <span className="no txt">선발</span>
                  <div className="who-sel">
                    <select className="select" value={d.pitcherId ?? ""} onChange={e => setPitcher(e.target.value)} aria-label="선발 투수">
                      <option value="">— 선발 투수 —</option>
                      {playerOptions(players.filter(p => p.position === "투수"))}
                      <optgroup label="야수">
                        {players.filter(p => p.position !== "투수").map(p => <option key={p.id} value={p.id}>{optionLabel(p)}</option>)}
                      </optgroup>
                    </select>
                  </div>
                  <span className="small muted">투수 · 타석 없음</span>
                </div>
              )}
            </div>

            <div className="lu-issues" aria-live="polite">
              {issues.length === 0 && <span className="it ok">9자리 수비와 타순이 모두 채워졌습니다.</span>}
              {issues.map((x, k) => <span key={k} className={`it ${x.level}`}>{x.text}</span>)}
            </div>
          </div>

          <div>
            <LineupField lineup={d} players={players} />
            <Cells n={3} className="mt12">
              <Cell label="전력" value={strength.avg} size="md" meter={strength.avg} sub="출전 선수 종합 평균" />
              <Cell label="공격" value={strength.attack} size="md" meter={strength.attack} sub="타순 9명" />
              <Cell label="수비" value={strength.defense} size="md" meter={strength.defense} sub="선발 50% + 야수 50%" />
            </Cells>
          </div>
        </div>

        <div className="field mt12" style={{ marginTop: 20 }}>
          <label htmlFor="lu-memo">선수단 전달 사항</label>
          <textarea
            id="lu-memo"
            value={d.memo}
            onChange={e => setD(prev => ({ ...prev, memo: e.target.value }))}
            placeholder="예: 상대 선발이 좌완이면 7번 자리는 우타자로 바꿉니다. 경기 전 미팅 08:30."
            style={{ minHeight: 72 }}
          />
        </div>

        {msg && <Notice kind={msg.kind} className="mt12">{msg.text}</Notice>}

        <div className="lu-foot">
          <label className="check-row">
            <input type="checkbox" checked={d.published} onChange={e => setD(prev => ({ ...prev, published: e.target.checked }))} />
            선수단에 공개
          </label>
          <div className="flex gap8 wrap">
            {game && own && (
              <button type="button" className="btn ghost sm" onClick={dropOwn}>전용 라인업 지우기</button>
            )}
            <button type="button" className="btn sm" onClick={save} disabled={!dirty}>
              {game && !own ? "이 경기 전용으로 저장" : "저장"}
            </button>
          </div>
        </div>
      </div>
    </Section>

      <Section title="벤치 대기" meta={`${bench.length}명`}>
        <div className="panel">
          {bench.length === 0 ? (
            <Empty>모든 선수가 라인업에 들어가 있습니다.</Empty>
          ) : (
            <div className="lu-bench">
              {bench.map(p => (
                <span key={p.id} className="pill outline">#{p.backNumber} {p.name} · {p.positionDetail ?? p.position} · {p.grade}학년</span>
              ))}
            </div>
          )}
        </div>
      </Section>
    </>
  );
}

