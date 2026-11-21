import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../../lib/store";
import { Cell, Cells, Empty, Medal, Notice, PageHead } from "../../components/ui";
import { Icon } from "../../components/icons";
import { fmtDate } from "../../lib/format";
import { todayISO as today } from "../../lib/schedule";
import {
  GAME_TYPE_LABEL, battingAvg, battingTotalsByPlayer, eraOf, fmtAvg, fmtEra, fmtIp, gameTypeOf, gamesInYear, isValidIp,
  pitchingTotalsByPlayer,
} from "../../lib/stats";
import type { BattingLine, GameRecord, GameType, PitchingLine } from "../../lib/types";
import "../../styles/coach.css";
import "../../styles/games.css";

/* 입력 중에는 빈 칸을 허용해야 하므로 문자열로 들고 있다가 저장할 때 숫자로 바꾼다 */
interface BatRow {
  key: string; playerId: string; ab: string; hits: string; doubles: string; triples: string; hr: string;
  rbi: string; runs: string; bb: string; so: string; sb: string;
}
interface PitRow { key: string; playerId: string; ip: string; hits: string; er: string; so: string; bb: string }

/** 저장된 숫자 → 입력칸 문자열. 0·없음은 빈 칸(placeholder 0)으로 보여 준다 */
const strOf = (n: number | undefined) => (n ? String(n) : "");
/** 경기별 기록 탭에서 처음에 보여 주는 경기 수 */
const PAGE = 10;

const numOf = (s: string) => (s.trim() === "" ? 0 : Number(s));

function NumField({
  id, label, value, onChange, step = "1",
}: { id: string; label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min="0"
        step={step}
        inputMode={step === "1" ? "numeric" : "decimal"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
      />
    </div>
  );
}

export default function GamesPage() {
  const { db, user, allPlayers, addGame, updateGame, removeGame } = useStore();
  const teamId = user!.teamId;
  const games = db.games.filter(g => g.teamId === teamId).sort((a, b) => b.date.localeCompare(a.date));
  const players = db.players.filter(p => p.teamId === teamId);
  /** 보관된 선수까지 포함 — 지난 경기 기록의 이름 표시와, 그 기록을 수정할 때의 선수 선택에 쓴다 */
  const everyone = allPlayers.filter(p => p.teamId === teamId);
  const activeIds = useMemo(() => new Set(db.players.filter(p => p.teamId === teamId).map(p => p.id)), [db.players, teamId]);
  const nameOf = (id: string) => {
    const p = everyone.find(x => x.id === id);
    return p ? `${p.name}${p.archived ? " (보관)" : ""}` : "삭제된 선수";
  };
  const rosterOptions = useMemo(
    () => [...players].sort((a, b) => a.backNumber - b.backNumber),
    [players]
  );

  const [tab, setTab] = useState<"games" | "players" | "ranking">("games");

  /* ---------- 경기 등록 폼 ---------- */
  const seq = useRef(0);
  const newKey = () => `r${++seq.current}`;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [gameType, setGameType] = useState<GameType>("정식");
  const [opponent, setOpponent] = useState("");
  const [scoreFor, setScoreFor] = useState("");
  const [scoreAgainst, setScoreAgainst] = useState("");
  const [batRows, setBatRows] = useState<BatRow[]>([]);
  const [pitRows, setPitRows] = useState<PitRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  /** 수정 중인 경기 id (없으면 새 경기 등록) */
  const [editId, setEditId] = useState<string | null>(null);
  /** 월간 일정의 예정 경기에서 "결과 입력"으로 넘어왔을 때 그 예정 경기 id */
  const [sgId, setSgId] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState("경기 기록이 저장되었습니다.");
  /** 펼친 경기 카드 — 기본은 모두 접힘(요약 한 줄) */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showN, setShowN] = useState(PAGE);
  const formRef = useRef<HTMLDivElement>(null);
  const toggleExpand = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const scrollToForm = () =>
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  const resetForm = () => {
    setDate(today());
    setGameType("정식");
    setOpponent("");
    setScoreFor("");
    setScoreAgainst("");
    setBatRows([]);
    setPitRows([]);
    setErrors([]);
    setEditId(null);
    setSgId(null);
  };

  /** 등록 폼에 기존 경기 내용을 채워 수정 상태로 연다 */
  const startEdit = (g: GameRecord) => {
    setEditId(g.id);
    setSgId(null);
    setDate(g.date);
    setGameType(gameTypeOf(g));
    setOpponent(g.opponent);
    setScoreFor(String(g.scoreFor));
    setScoreAgainst(String(g.scoreAgainst));
    setBatRows(g.batting.map(b => ({
      key: newKey(), playerId: b.playerId, ab: strOf(b.ab), hits: strOf(b.hits), doubles: strOf(b.doubles),
      triples: strOf(b.triples), hr: strOf(b.hr), rbi: strOf(b.rbi), runs: strOf(b.runs), bb: strOf(b.bb),
      so: strOf(b.so), sb: strOf(b.sb),
    })));
    setPitRows(g.pitching.map(p => ({
      key: newKey(), playerId: p.playerId, ip: strOf(p.ip), hits: strOf(p.hits), er: strOf(p.er), so: strOf(p.so), bb: strOf(p.bb),
    })));
    setErrors([]);
    setSaved(false);
    setConfirmId(null);
    setOpen(true);
    scrollToForm();
  };

  /* 월간 일정에서 넘어온 경우: ?sg=예정경기id&date=&opp=&type= → 등록 폼을 채워서 연다. ?edit=기록id → 수정 */
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const edit = params.get("edit");
    const sg = params.get("sg");
    if (!edit && !sg) return;
    if (edit) {
      const g = db.games.find(x => x.id === edit && x.teamId === teamId);
      if (g) startEdit(g);
    } else if (sg) {
      const linked = db.games.find(x => x.scheduledGameId === sg && x.teamId === teamId);
      if (linked) startEdit(linked); // 이미 결과가 등록된 예정 경기 → 그 기록을 수정
      else {
        resetForm();
        setSgId(sg);
        setDate(params.get("date") || today());
        setGameType(params.get("type") === "연습" ? "연습" : "정식");
        setOpponent(params.get("opp") ?? "");
        setSaved(false);
        setOpen(true);
        scrollToForm();
      }
    }
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const toggleForm = () => {
    if (open) {
      setOpen(false);
      resetForm();
    } else {
      setSaved(false);
      setOpen(true);
    }
  };

  const addBatRow = () =>
    setBatRows(rows => [...rows, {
      key: newKey(), playerId: "", ab: "", hits: "", doubles: "", triples: "", hr: "", rbi: "", runs: "", bb: "", so: "", sb: "",
    }]);
  const addPitRow = () =>
    setPitRows(rows => [...rows, { key: newKey(), playerId: "", ip: "", hits: "", er: "", so: "", bb: "" }]);

  const patchBat = (key: string, patch: Partial<BatRow>) =>
    setBatRows(rows => rows.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const patchPit = (key: string, patch: Partial<PitRow>) =>
    setPitRows(rows => rows.map(r => (r.key === key ? { ...r, ...patch } : r)));

  /** 같은 표의 다른 행이 이미 고른 선수는 목록에서 뺀다 */
  const pickable = (usedIds: string[], mine: string) => {
    const list = rosterOptions.filter(p => p.id === mine || !usedIds.includes(p.id));
    // 보관된 선수가 들어 있는 지난 기록을 고칠 때는 그 행에서만 그 선수를 그대로 둘 수 있다
    const kept = mine && !activeIds.has(mine) ? everyone.find(p => p.id === mine) : undefined;
    return kept ? [kept, ...list] : list;
  };

  const sfNum = Number(scoreFor);
  const saNum = Number(scoreAgainst);
  const scoresReady =
    scoreFor.trim() !== "" && scoreAgainst.trim() !== "" && Number.isFinite(sfNum) && Number.isFinite(saNum);
  const preview = scoresReady ? (sfNum > saNum ? "승" : sfNum < saNum ? "패" : "무") : null;

  const rowTag = (kind: string, i: number, playerId: string) =>
    `${kind} ${playerId ? `${nameOf(playerId)} 선수` : `${i + 1}번째 행`}`;

  function validate(): string[] {
    const errs: string[] = [];

    if (!date) errs.push("경기 날짜를 입력합니다.");
    if (!opponent.trim()) errs.push("상대 팀 이름을 입력합니다.");

    if (scoreFor.trim() === "" || scoreAgainst.trim() === "") {
      errs.push("우리 점수와 상대 점수를 모두 입력합니다.");
    } else {
      if (!Number.isInteger(sfNum) || sfNum < 0) errs.push("우리 점수는 0 이상 정수로 입력합니다.");
      if (!Number.isInteger(saNum) || saNum < 0) errs.push("상대 점수는 0 이상 정수로 입력합니다.");
    }

    const seenBat: string[] = [];
    batRows.forEach((r, i) => {
      const tag = rowTag("타격", i, r.playerId);
      if (!r.playerId) errs.push(`타격 ${i + 1}번째 행의 선수를 선택합니다.`);
      else if (seenBat.includes(r.playerId)) errs.push(`타격 기록에 ${nameOf(r.playerId)} 선수가 두 번 들어 있습니다.`);
      else seenBat.push(r.playerId);

      const cells: [string, string][] = [
        ["타수", r.ab], ["안타", r.hits], ["2루타", r.doubles], ["3루타", r.triples], ["홈런", r.hr],
        ["타점", r.rbi], ["득점", r.runs], ["볼넷", r.bb], ["삼진", r.so], ["도루", r.sb],
      ];
      for (const [label, raw] of cells) {
        const v = numOf(raw);
        if (!Number.isFinite(v) || v < 0) errs.push(`${tag}의 '${label}' 값은 0 이상 숫자로 입력합니다.`);
        else if (!Number.isInteger(v)) errs.push(`${tag}의 '${label}' 값은 정수로 입력합니다.`);
      }

      const ab = numOf(r.ab), hits = numOf(r.hits), hr = numOf(r.hr);
      const d2 = numOf(r.doubles), d3 = numOf(r.triples);
      if (Number.isFinite(ab) && Number.isFinite(hits) && hits > ab)
        errs.push(`${tag}의 안타(${hits})가 타수(${ab})보다 많습니다.`);
      const xbh = d2 + d3 + hr;
      if (Number.isFinite(hits) && Number.isFinite(xbh) && xbh > hits)
        errs.push(`${tag}의 2루타+3루타+홈런(${xbh})이 안타(${hits})보다 많습니다.`);
    });

    const seenPit: string[] = [];
    pitRows.forEach((r, i) => {
      const tag = rowTag("투구", i, r.playerId);
      if (!r.playerId) errs.push(`투구 ${i + 1}번째 행의 선수를 선택합니다.`);
      else if (seenPit.includes(r.playerId)) errs.push(`투구 기록에 ${nameOf(r.playerId)} 선수가 두 번 들어 있습니다.`);
      else seenPit.push(r.playerId);

      const ip = numOf(r.ip);
      if (!isValidIp(ip)) errs.push(`${tag}의 '이닝'은 ⅓ 단위로 입력합니다. 5⅓이닝은 5.1, 5⅔이닝은 5.2로 적습니다.`);

      const cells: [string, string][] = [["피안타", r.hits], ["자책", r.er], ["탈삼진", r.so], ["볼넷", r.bb]];
      for (const [label, raw] of cells) {
        const v = numOf(raw);
        if (!Number.isFinite(v) || v < 0) errs.push(`${tag}의 '${label}' 값은 0 이상 숫자로 입력합니다.`);
        else if (!Number.isInteger(v)) errs.push(`${tag}의 '${label}' 값은 정수로 입력합니다.`);
      }
    });

    return errs;
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;

    const batting: BattingLine[] = batRows.map(r => ({
      playerId: r.playerId,
      ab: numOf(r.ab), hits: numOf(r.hits), hr: numOf(r.hr), rbi: numOf(r.rbi), sb: numOf(r.sb),
      doubles: numOf(r.doubles), triples: numOf(r.triples), runs: numOf(r.runs), bb: numOf(r.bb), so: numOf(r.so),
    }));
    const pitching: PitchingLine[] = pitRows.map(r => ({
      playerId: r.playerId,
      ip: Math.round(numOf(r.ip) * 10) / 10, er: numOf(r.er), so: numOf(r.so), bb: numOf(r.bb),
      hits: numOf(r.hits),
    }));

    const body = {
      date,
      type: gameType,
      opponent: opponent.trim(),
      scoreFor: sfNum,
      scoreAgainst: saNum,
      batting,
      pitching,
    };
    if (editId) {
      updateGame(editId, body);
      setExpanded(prev => new Set(prev).add(editId));
      setSavedMsg("경기 기록을 수정했습니다.");
    } else {
      addGame(teamId, sgId ? { ...body, scheduledGameId: sgId } : body);
      setSavedMsg(sgId ? "경기 결과가 저장되었습니다. 월간 일정에도 점수가 표시됩니다." : "경기 기록이 저장되었습니다.");
    }

    resetForm();
    setOpen(false);
    setSaved(true);
    setTab("games");
  };

  /* ---------- 집계 ---------- */
  // 시즌 전적·선수 개별 기록·랭킹은 올해 경기만 센다 (대시보드·선수단·선수 상세의 '이번 시즌'과 같은 기준)
  const seasonYear = new Date().getFullYear();
  const seasonGames = useMemo(() => gamesInYear(games, seasonYear), [db.games, teamId, seasonYear]); // eslint-disable-line react-hooks/exhaustive-deps
  const record = useMemo(() => {
    const w = seasonGames.filter(g => g.result === "승").length;
    const l = seasonGames.filter(g => g.result === "패").length;
    const d = seasonGames.filter(g => g.result === "무").length;
    const rf = seasonGames.reduce((s, g) => s + g.scoreFor, 0);
    const ra = seasonGames.reduce((s, g) => s + g.scoreAgainst, 0);
    return { w, l, d, rf, ra };
  }, [seasonGames]);

  const batTotals = useMemo(
    () =>
      [...battingTotalsByPlayer(seasonGames).entries()]
        .filter(([playerId]) => activeIds.has(playerId))
        .map(([playerId, s]) => ({ playerId, ...s, avg: battingAvg(s.hits, s.ab) ?? 0 })),
    [seasonGames, activeIds]
  );

  const pitTotals = useMemo(
    () =>
      [...pitchingTotalsByPlayer(seasonGames).entries()]
        .filter(([playerId]) => activeIds.has(playerId))
        .map(([playerId, s]) => ({ playerId, ...s, era: eraOf(s.er, s.ip) ?? 0 })),
    [seasonGames, activeIds]
  );

  const rankingBlocks = [
    { title: "타율", rows: [...batTotals].sort((a, b) => b.avg - a.avg).slice(0, 5).map(r => ({ id: r.playerId, val: fmtAvg(r.avg) })) },
    { title: "홈런", rows: [...batTotals].sort((a, b) => b.hr - a.hr).slice(0, 5).map(r => ({ id: r.playerId, val: `${r.hr}` })) },
    { title: "타점", rows: [...batTotals].sort((a, b) => b.rbi - a.rbi).slice(0, 5).map(r => ({ id: r.playerId, val: `${r.rbi}` })) },
    { title: "도루", rows: [...batTotals].sort((a, b) => b.sb - a.sb).slice(0, 5).map(r => ({ id: r.playerId, val: `${r.sb}` })) },
    { title: "평균자책점 (ERA)", rows: [...pitTotals].filter(r => r.ip > 0).sort((a, b) => a.era - b.era).slice(0, 5).map(r => ({ id: r.playerId, val: fmtEra(r.era) })) },
    { title: "탈삼진", rows: [...pitTotals].sort((a, b) => b.so - a.so).slice(0, 5).map(r => ({ id: r.playerId, val: `${r.so}` })) },
  ];

  const resultPill = (result: string) => (result === "승" ? "good" : result === "패" ? "bad" : "warn");

  const n = seasonGames.length;
  const diff = record.rf - record.ra;

  const batUsed = batRows.filter(r => r.playerId).map(r => r.playerId);
  const pitUsed = pitRows.filter(r => r.playerId).map(r => r.playerId);

  return (
    <>
      <PageHead
        title="시합 기록"
        desc="팀 기록, 선수 개별 기록, 각 부문 랭킹을 확인합니다."
        actions={
          <button type="button" className={open ? "btn outline" : "btn"} onClick={toggleForm}>
            {open ? "닫기" : <><Icon.Plus /> 경기 등록</>}
          </button>
        }
      />

      <div className="panel hero">
        <div className="flex gap24 wrap start">
          <div>
            <div className="eyebrow mb8">{seasonYear} 시즌 전적</div>
            <div className="display">
              {record.w}승 {record.l}패
              <span className="unit">{record.d}무 · {n}경기</span>
            </div>
          </div>
          <div className="hero-stats">
            <Cells n={3}>
              <Cell
                label="득점 / 실점"
                size="md"
                value={`${record.rf} / ${record.ra}`}
                sub={`득실차 ${diff >= 0 ? "+" : ""}${diff}`}
              />
              <Cell label="경기당 득점" size="md" value={n ? (record.rf / n).toFixed(1) : "-"} unit={n ? "점" : undefined} />
              <Cell label="경기당 실점" size="md" value={n ? (record.ra / n).toFixed(1) : "-"} unit={n ? "점" : undefined} />
            </Cells>
          </div>
        </div>
      </div>

      {saved && !open && (
        <div className="mt12">
          <Notice kind="ok">{savedMsg}</Notice>
        </div>
      )}

      {open && (
        <div className="panel game-form" ref={formRef}>
          <div className="card-head">
            <h3>{editId ? "경기 수정" : sgId ? "경기 결과 입력" : "경기 등록"}</h3>
            <span className="meta">
              {sgId ? "월간 일정의 예정 경기와 연결됩니다 · " : ""}결과는 점수로 자동 판정합니다
            </span>
          </div>

          <form onSubmit={submit}>
            <div className="form-grid cols-2">
              <div className="field">
                <label htmlFor="game-date">경기 날짜</label>
                <input id="game-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="game-type">경기 구분</label>
                <select id="game-type" value={gameType} onChange={e => setGameType(e.target.value as GameType)}>
                  <option value="정식">정식경기</option>
                  <option value="연습">연습경기</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="game-opp">상대 팀</label>
                <input
                  id="game-opp"
                  type="text"
                  value={opponent}
                  onChange={e => setOpponent(e.target.value)}
                  placeholder="예: 서울고"
                />
              </div>
              <div className="field">
                <label htmlFor="game-sf">우리 점수</label>
                <input
                  id="game-sf" type="number" min="0" step="1" inputMode="numeric"
                  value={scoreFor} onChange={e => setScoreFor(e.target.value)} placeholder="0"
                />
              </div>
              <div className="field">
                <label htmlFor="game-sa">상대 점수</label>
                <input
                  id="game-sa" type="number" min="0" step="1" inputMode="numeric"
                  value={scoreAgainst} onChange={e => setScoreAgainst(e.target.value)} placeholder="0"
                />
              </div>
            </div>

            {preview && (
              <div className="flex gap8 mt16">
                <span className={`pill ${resultPill(preview)}`}>{preview}</span>
                <span className="faint small">점수로 자동 판정</span>
              </div>
            )}

            <div className="divider" />

            <div className="columns n2">
              <div className="col">
                <div className="col-head">
                  <h4>타격 기록</h4>
                  <button type="button" className="btn outline sm" onClick={addBatRow}>
                    <Icon.Plus /> 선수 추가
                  </button>
                </div>
                {batRows.length === 0 ? (
                  <div className="faint small game-col-empty">선수를 추가해 기록을 입력합니다.</div>
                ) : (
                  batRows.map((r, i) => (
                    <div className="game-row" key={r.key}>
                      <div className="game-row-fields">
                        <div className="field game-who">
                          <label htmlFor={`bat-${r.key}-who`}>선수</label>
                          <select
                            id={`bat-${r.key}-who`}
                            value={r.playerId}
                            onChange={e => patchBat(r.key, { playerId: e.target.value })}
                          >
                            <option value="">선수 선택</option>
                            {pickable(batUsed, r.playerId).map(p => (
                              <option key={p.id} value={p.id}>{p.backNumber}번 {p.name}{p.archived ? " (보관)" : ""}</option>
                            ))}
                          </select>
                        </div>
                        <NumField id={`bat-${r.key}-ab`} label="타수" value={r.ab} onChange={v => patchBat(r.key, { ab: v })} />
                        <NumField id={`bat-${r.key}-hits`} label="안타" value={r.hits} onChange={v => patchBat(r.key, { hits: v })} />
                        <NumField id={`bat-${r.key}-doubles`} label="2루타" value={r.doubles} onChange={v => patchBat(r.key, { doubles: v })} />
                        <NumField id={`bat-${r.key}-triples`} label="3루타" value={r.triples} onChange={v => patchBat(r.key, { triples: v })} />
                        <NumField id={`bat-${r.key}-hr`} label="홈런" value={r.hr} onChange={v => patchBat(r.key, { hr: v })} />
                        <NumField id={`bat-${r.key}-rbi`} label="타점" value={r.rbi} onChange={v => patchBat(r.key, { rbi: v })} />
                        <NumField id={`bat-${r.key}-runs`} label="득점" value={r.runs} onChange={v => patchBat(r.key, { runs: v })} />
                        <NumField id={`bat-${r.key}-bb`} label="볼넷" value={r.bb} onChange={v => patchBat(r.key, { bb: v })} />
                        <NumField id={`bat-${r.key}-so`} label="삼진" value={r.so} onChange={v => patchBat(r.key, { so: v })} />
                        <NumField id={`bat-${r.key}-sb`} label="도루" value={r.sb} onChange={v => patchBat(r.key, { sb: v })} />
                      </div>
                      <button
                        type="button"
                        className="icon-btn sm danger"
                        aria-label="행 삭제"
                        title={`타격 ${i + 1}번째 행 삭제`}
                        onClick={() => setBatRows(rows => rows.filter(x => x.key !== r.key))}
                      >
                        <Icon.Trash />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="col">
                <div className="col-head">
                  <h4>투구 기록</h4>
                  <button type="button" className="btn outline sm" onClick={addPitRow}>
                    <Icon.Plus /> 선수 추가
                  </button>
                </div>
                {pitRows.length === 0 ? (
                  <div className="faint small game-col-empty">선수를 추가해 기록을 입력합니다.</div>
                ) : (
                  pitRows.map((r, i) => (
                    <div className="game-row" key={r.key}>
                      <div className="game-row-fields">
                        <div className="field game-who">
                          <label htmlFor={`pit-${r.key}-who`}>선수</label>
                          <select
                            id={`pit-${r.key}-who`}
                            value={r.playerId}
                            onChange={e => patchPit(r.key, { playerId: e.target.value })}
                          >
                            <option value="">선수 선택</option>
                            {pickable(pitUsed, r.playerId).map(p => (
                              <option key={p.id} value={p.id}>{p.backNumber}번 {p.name}{p.archived ? " (보관)" : ""}</option>
                            ))}
                          </select>
                        </div>
                        <NumField id={`pit-${r.key}-ip`} label="이닝(.1=⅓)" value={r.ip} step="0.1" onChange={v => patchPit(r.key, { ip: v })} />
                        <NumField id={`pit-${r.key}-hits`} label="피안타" value={r.hits} onChange={v => patchPit(r.key, { hits: v })} />
                        <NumField id={`pit-${r.key}-er`} label="자책" value={r.er} onChange={v => patchPit(r.key, { er: v })} />
                        <NumField id={`pit-${r.key}-so`} label="탈삼진" value={r.so} onChange={v => patchPit(r.key, { so: v })} />
                        <NumField id={`pit-${r.key}-bb`} label="볼넷" value={r.bb} onChange={v => patchPit(r.key, { bb: v })} />
                      </div>
                      <button
                        type="button"
                        className="icon-btn sm danger"
                        aria-label="행 삭제"
                        title={`투구 ${i + 1}번째 행 삭제`}
                        onClick={() => setPitRows(rows => rows.filter(x => x.key !== r.key))}
                      >
                        <Icon.Trash />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {errors.length > 0 && (
              <div className="game-form-msgs mt16">
                <Notice kind="error">
                  {errors.length === 1 ? (
                    errors[0]
                  ) : (
                    <>
                      <b>{errors.length}건을 고쳐야 저장할 수 있습니다.</b>
                      {errors.map((m, i) => <div key={i} className="mt4">· {m}</div>)}
                    </>
                  )}
                </Notice>
              </div>
            )}

            <div className="flex gap8 wrap mt16">
              <button type="submit" className="btn">{editId ? "수정 저장" : "경기 기록 저장"}</button>
              <button type="button" className="btn ghost" onClick={toggleForm}>취소</button>
            </div>
          </form>
        </div>
      )}

      <div className="tabs mt24">
        <button className={tab === "games" ? "on" : ""} onClick={() => setTab("games")}>경기별 기록</button>
        <button className={tab === "players" ? "on" : ""} onClick={() => setTab("players")}>선수 개별 기록</button>
        <button className={tab === "ranking" ? "on" : ""} onClick={() => setTab("ranking")}>부문별 랭킹</button>
      </div>

      {tab === "games" && (
        games.length === 0 ? (
          <Empty>등록된 경기 기록이 없습니다. 위 '경기 등록'에서 첫 경기를 추가하세요.</Empty>
        ) : (
          <>
          <div className="flex between wrap mt12 game-list-bar">
            <span className="faint small">
              전체 {games.length}경기 중 {Math.min(showN, games.length)}경기 · 경기를 누르면 선수별 기록이 펼쳐집니다
            </span>
            {games.slice(0, showN).some(g => expanded.has(g.id)) && (
              <button type="button" className="link-btn" onClick={() => setExpanded(new Set())}>모두 접기</button>
            )}
          </div>
          {games.slice(0, showN).map(g => {
            const lost = g.result === "패";
            const won = g.result === "승";
            const isOpen = expanded.has(g.id);
            return (
              <div className={`panel game-card${isOpen ? " open" : ""}${editId === g.id ? " editing" : ""}`} key={g.id}>
                <div className="scoreline">
                  <button
                    type="button"
                    className="game-toggle"
                    aria-expanded={isOpen}
                    aria-label={`${fmtDate(g.date)} vs ${g.opponent} 선수별 기록 ${isOpen ? "접기" : "펼치기"}`}
                    onClick={() => toggleExpand(g.id)}
                  >
                    {isOpen ? <Icon.ChevronUp /> : <Icon.ChevronDown />}
                  </button>
                  <div className="score">
                    <span className={lost ? "lose" : ""}>{g.scoreFor}</span>
                    <span className="sep">:</span>
                    <span className={won ? "lose" : ""}>{g.scoreAgainst}</span>
                  </div>
                  <div className="opp">
                    vs {g.opponent}
                    <small>{fmtDate(g.date)} · {GAME_TYPE_LABEL[gameTypeOf(g)]}</small>
                  </div>
                  <div className="right">
                    <span className={`pill ${resultPill(g.result)}`}>{g.result}</span>
                    {confirmId === g.id ? (
                      <>
                        <span className="faint small">삭제하면 되돌릴 수 없습니다.</span>
                        <button
                          type="button"
                          className="btn sm danger"
                          onClick={() => { removeGame(g.id); setConfirmId(null); }}
                        >
                          삭제
                        </button>
                        <button type="button" className="btn ghost sm" onClick={() => setConfirmId(null)}>취소</button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="icon-btn sm"
                          aria-label="경기 기록 수정"
                          title="경기 기록 수정"
                          onClick={() => startEdit(g)}
                        >
                          <Icon.PenLine />
                        </button>
                        <button
                          type="button"
                          className="icon-btn sm danger"
                          aria-label="경기 기록 삭제"
                          title="경기 기록 삭제"
                          onClick={() => setConfirmId(g.id)}
                        >
                          <Icon.Trash />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {!isOpen ? (
                  <button type="button" className="game-summary" onClick={() => toggleExpand(g.id)}>
                    타격 {g.batting.length}명 · 투구 {g.pitching.length}명 기록 보기
                  </button>
                ) : (
                <>
                <div className="divider" />

                <div className="columns n2">
                  <div className="col">
                    <div className="col-head"><h4>타격</h4></div>
                    {g.batting.length === 0 ? (
                      <Empty>타격 기록 없음</Empty>
                    ) : (
                      <div className="tbl-wrap">
                        <table className="tbl compact">
                          <thead>
                            <tr>
                              <th>선수</th><th className="num">타수</th><th className="num">안타</th><th className="num">2루타</th>
                              <th className="num">3루타</th><th className="num">홈런</th><th className="num">타점</th><th className="num">득점</th>
                              <th className="num">볼넷</th><th className="num">삼진</th><th className="num">도루</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.batting.map(b => (
                              <tr key={b.playerId}>
                                <td className="name">{nameOf(b.playerId)}</td>
                                <td className="num">{b.ab}</td>
                                <td className="num">{b.hits}</td>
                                <td className="num">{b.doubles ?? 0}</td>
                                <td className="num">{b.triples ?? 0}</td>
                                <td className="num">{b.hr}</td>
                                <td className="num">{b.rbi}</td>
                                <td className="num">{b.runs ?? 0}</td>
                                <td className="num">{b.bb ?? 0}</td>
                                <td className="num">{b.so ?? 0}</td>
                                <td className="num">{b.sb}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <div className="col">
                    <div className="col-head"><h4>투구</h4></div>
                    {g.pitching.length === 0 ? (
                      <Empty>투구 기록 없음</Empty>
                    ) : (
                      <div className="tbl-wrap">
                        <table className="tbl compact">
                          <thead>
                            <tr><th>선수</th><th className="num">이닝</th><th className="num">피안타</th><th className="num">자책</th><th className="num">탈삼진</th><th className="num">볼넷</th></tr>
                          </thead>
                          <tbody>
                            {g.pitching.map(p => (
                              <tr key={p.playerId}>
                                <td className="name">{nameOf(p.playerId)}</td>
                                <td className="num">{fmtIp(p.ip)}</td>
                                <td className="num">{p.hits ?? "-"}</td>
                                <td className="num">{p.er}</td>
                                <td className="num">{p.so}</td>
                                <td className="num">{p.bb}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
                </>
                )}
              </div>
            );
          })}
          {games.length > showN && (
            <div className="game-more">
              <button type="button" className="btn outline" onClick={() => setShowN(n => n + PAGE)}>
                더 보기 <span className="faint">({games.length - showN}경기 남음)</span>
              </button>
              <button type="button" className="link-btn" onClick={() => setShowN(games.length)}>전체 보기</button>
            </div>
          )}
          </>
        )
      )}

      {tab === "players" && (
        <>
          <p className="faint small mt12 game-list-bar">{seasonYear} 시즌 정식·연습경기 합산 · 보관된 선수 제외 · 선수 상세의 '{seasonYear}년 성적'과 같은 값입니다</p>
          <div className="panel">
            <div className="card-head">
              <h3>타격 누적</h3>
              <span className="meta">{batTotals.length}명 · 타율순</span>
            </div>
            {batTotals.length === 0 ? (
              <Empty>타격 기록이 없습니다.</Empty>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>선수</th><th className="num">경기</th><th className="num">타수</th><th className="num">안타</th><th className="num sorted">타율</th>
                      <th className="num">2루타</th><th className="num">3루타</th><th className="num">홈런</th><th className="num">타점</th>
                      <th className="num">득점</th><th className="num">볼넷</th><th className="num">삼진</th><th className="num">도루</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...batTotals].sort((a, b) => b.avg - a.avg).map(r => (
                      <tr key={r.playerId}>
                        <td className="name">{nameOf(r.playerId)}</td>
                        <td className="num">{r.games}</td>
                        <td className="num">{r.ab}</td>
                        <td className="num">{r.hits}</td>
                        <td className="num"><b>{r.ab > 0 ? fmtAvg(r.avg) : "-"}</b></td>
                        <td className="num">{r.doubles}</td>
                        <td className="num">{r.triples}</td>
                        <td className="num">{r.hr}</td>
                        <td className="num">{r.rbi}</td>
                        <td className="num">{r.runs}</td>
                        <td className="num">{r.bb}</td>
                        <td className="num">{r.so}</td>
                        <td className="num">{r.sb}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="panel game-totals-next">
            <div className="card-head">
              <h3>투구 누적</h3>
              <span className="meta">{pitTotals.length}명 · ERA순</span>
            </div>
            {pitTotals.length === 0 ? (
              <Empty>투구 기록이 없습니다.</Empty>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>선수</th><th className="num">경기</th><th className="num">이닝</th><th className="num">피안타</th><th className="num">자책</th><th className="num sorted">ERA</th><th className="num">탈삼진</th><th className="num">볼넷</th></tr>
                  </thead>
                  <tbody>
                    {[...pitTotals].sort((a, b) => (a.ip > 0 ? 0 : 1) - (b.ip > 0 ? 0 : 1) || a.era - b.era).map(r => (
                      <tr key={r.playerId}>
                        <td className="name">{nameOf(r.playerId)}</td>
                        <td className="num">{r.games}</td>
                        <td className="num">{fmtIp(r.ip)}</td>
                        <td className="num">{r.hits}</td>
                        <td className="num">{r.er}</td>
                        <td className="num"><b>{r.ip > 0 ? fmtEra(r.era) : "-"}</b></td>
                        <td className="num">{r.so}</td>
                        <td className="num">{r.bb}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "ranking" && (
        <>
        <p className="faint small mt12 game-list-bar">{seasonYear} 시즌 기록 기준 · 보관된 선수 제외</p>
        <div className="grid cols-3">
          {rankingBlocks.map(block => (
            <div className="panel sub" key={block.title}>
              <div className="card-head">
                <h3>{block.title}</h3>
              </div>
              {block.rows.length === 0 ? (
                <Empty>기록 없음</Empty>
              ) : (
                <div className="rows">
                  {block.rows.map((r, i) => (
                    <div className="row compact" key={r.id}>
                      <Medal rank={i + 1} />
                      <div className="grow">
                        <div className="title">{nameOf(r.id)}</div>
                      </div>
                      <div className="right"><b>{r.val}</b></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        </>
      )}
    </>
  );
}
