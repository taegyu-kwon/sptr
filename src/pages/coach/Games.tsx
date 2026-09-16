import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../../lib/store";
import { Cell, Cells, Empty, Medal, Notice, PageHead } from "../../components/ui";
import { Icon } from "../../components/icons";
import { fmtDate } from "../../lib/format";
import { today } from "../../lib/roster";
import type { BattingLine, PitchingLine } from "../../lib/types";
import "../../styles/coach.css";
import "../../styles/games.css";

/* 입력 중에는 빈 칸을 허용해야 하므로 문자열로 들고 있다가 저장할 때 숫자로 바꾼다 */
interface BatRow { key: string; playerId: string; ab: string; hits: string; hr: string; rbi: string; sb: string }
interface PitRow { key: string; playerId: string; ip: string; er: string; so: string; bb: string }

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
  const { db, user, addGame, removeGame } = useStore();
  const teamId = user!.teamId;
  const games = db.games.filter(g => g.teamId === teamId).sort((a, b) => b.date.localeCompare(a.date));
  const players = db.players.filter(p => p.teamId === teamId);
  const nameOf = (id: string) => players.find(p => p.id === id)?.name ?? "?";
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
  const [opponent, setOpponent] = useState("");
  const [scoreFor, setScoreFor] = useState("");
  const [scoreAgainst, setScoreAgainst] = useState("");
  const [batRows, setBatRows] = useState<BatRow[]>([]);
  const [pitRows, setPitRows] = useState<PitRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  const resetForm = () => {
    setDate(today());
    setOpponent("");
    setScoreFor("");
    setScoreAgainst("");
    setBatRows([]);
    setPitRows([]);
    setErrors([]);
  };

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
    setBatRows(rows => [...rows, { key: newKey(), playerId: "", ab: "", hits: "", hr: "", rbi: "", sb: "" }]);
  const addPitRow = () =>
    setPitRows(rows => [...rows, { key: newKey(), playerId: "", ip: "", er: "", so: "", bb: "" }]);

  const patchBat = (key: string, patch: Partial<BatRow>) =>
    setBatRows(rows => rows.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const patchPit = (key: string, patch: Partial<PitRow>) =>
    setPitRows(rows => rows.map(r => (r.key === key ? { ...r, ...patch } : r)));

  /** 같은 표의 다른 행이 이미 고른 선수는 목록에서 뺀다 */
  const pickable = (usedIds: string[], mine: string) =>
    rosterOptions.filter(p => p.id === mine || !usedIds.includes(p.id));

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
        ["타수", r.ab], ["안타", r.hits], ["홈런", r.hr], ["타점", r.rbi], ["도루", r.sb],
      ];
      for (const [label, raw] of cells) {
        const v = numOf(raw);
        if (!Number.isFinite(v) || v < 0) errs.push(`${tag}의 '${label}' 값은 0 이상 숫자로 입력합니다.`);
        else if (!Number.isInteger(v)) errs.push(`${tag}의 '${label}' 값은 정수로 입력합니다.`);
      }

      const ab = numOf(r.ab), hits = numOf(r.hits), hr = numOf(r.hr);
      if (Number.isFinite(ab) && Number.isFinite(hits) && hits > ab)
        errs.push(`${tag}의 안타(${hits})가 타수(${ab})보다 많습니다.`);
      if (Number.isFinite(hits) && Number.isFinite(hr) && hr > hits)
        errs.push(`${tag}의 홈런(${hr})이 안타(${hits})보다 많습니다.`);
    });

    const seenPit: string[] = [];
    pitRows.forEach((r, i) => {
      const tag = rowTag("투구", i, r.playerId);
      if (!r.playerId) errs.push(`투구 ${i + 1}번째 행의 선수를 선택합니다.`);
      else if (seenPit.includes(r.playerId)) errs.push(`투구 기록에 ${nameOf(r.playerId)} 선수가 두 번 들어 있습니다.`);
      else seenPit.push(r.playerId);

      const ip = numOf(r.ip);
      if (!Number.isFinite(ip) || ip < 0) errs.push(`${tag}의 '이닝' 값은 0 이상 숫자로 입력합니다.`);

      const cells: [string, string][] = [["자책", r.er], ["탈삼진", r.so], ["볼넷", r.bb]];
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
    }));
    const pitching: PitchingLine[] = pitRows.map(r => ({
      playerId: r.playerId,
      ip: Math.round(numOf(r.ip) * 10) / 10, er: numOf(r.er), so: numOf(r.so), bb: numOf(r.bb),
    }));

    addGame(teamId, {
      date,
      opponent: opponent.trim(),
      scoreFor: sfNum,
      scoreAgainst: saNum,
      batting,
      pitching,
    });

    resetForm();
    setOpen(false);
    setSaved(true);
    setTab("games");
  };

  /* ---------- 집계 ---------- */
  const record = useMemo(() => {
    const w = games.filter(g => g.result === "승").length;
    const l = games.filter(g => g.result === "패").length;
    const d = games.filter(g => g.result === "무").length;
    const rf = games.reduce((s, g) => s + g.scoreFor, 0);
    const ra = games.reduce((s, g) => s + g.scoreAgainst, 0);
    return { w, l, d, rf, ra };
  }, [games]);

  const batTotals = useMemo(() => {
    const map = new Map<string, { ab: number; hits: number; hr: number; rbi: number; sb: number }>();
    for (const g of games)
      for (const b of g.batting) {
        const cur = map.get(b.playerId) ?? { ab: 0, hits: 0, hr: 0, rbi: 0, sb: 0 };
        map.set(b.playerId, {
          ab: cur.ab + b.ab, hits: cur.hits + b.hits, hr: cur.hr + b.hr, rbi: cur.rbi + b.rbi, sb: cur.sb + b.sb,
        });
      }
    return [...map.entries()].map(([playerId, s]) => ({
      playerId, ...s, avg: s.ab > 0 ? s.hits / s.ab : 0,
    }));
  }, [games]);

  const pitTotals = useMemo(() => {
    const map = new Map<string, { ip: number; er: number; so: number; bb: number }>();
    for (const g of games)
      for (const p of g.pitching) {
        const cur = map.get(p.playerId) ?? { ip: 0, er: 0, so: 0, bb: 0 };
        map.set(p.playerId, { ip: cur.ip + p.ip, er: cur.er + p.er, so: cur.so + p.so, bb: cur.bb + p.bb });
      }
    return [...map.entries()].map(([playerId, s]) => ({
      playerId, ...s, ip: Math.round(s.ip * 10) / 10, era: s.ip > 0 ? (s.er * 9) / s.ip : 0,
    }));
  }, [games]);

  const fmtAvg = (v: number) => v.toFixed(3).replace(/^0/, "");

  const rankingBlocks = [
    { title: "타율", rows: [...batTotals].sort((a, b) => b.avg - a.avg).slice(0, 5).map(r => ({ id: r.playerId, val: fmtAvg(r.avg) })) },
    { title: "홈런", rows: [...batTotals].sort((a, b) => b.hr - a.hr).slice(0, 5).map(r => ({ id: r.playerId, val: `${r.hr}` })) },
    { title: "타점", rows: [...batTotals].sort((a, b) => b.rbi - a.rbi).slice(0, 5).map(r => ({ id: r.playerId, val: `${r.rbi}` })) },
    { title: "도루", rows: [...batTotals].sort((a, b) => b.sb - a.sb).slice(0, 5).map(r => ({ id: r.playerId, val: `${r.sb}` })) },
    { title: "평균자책점 (ERA)", rows: [...pitTotals].sort((a, b) => a.era - b.era).slice(0, 5).map(r => ({ id: r.playerId, val: r.era.toFixed(2) })) },
    { title: "탈삼진", rows: [...pitTotals].sort((a, b) => b.so - a.so).slice(0, 5).map(r => ({ id: r.playerId, val: `${r.so}` })) },
  ];

  const resultPill = (result: string) => (result === "승" ? "good" : result === "패" ? "bad" : "warn");

  const n = games.length;
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
            <div className="eyebrow mb8">시즌 전적</div>
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
          <Notice kind="ok">경기 기록이 저장되었습니다.</Notice>
        </div>
      )}

      {open && (
        <div className="panel">
          <div className="card-head">
            <h3>경기 등록</h3>
            <span className="meta">결과는 점수로 자동 판정합니다</span>
          </div>

          <form onSubmit={submit}>
            <div className="form-grid cols-2">
              <div className="field">
                <label htmlFor="game-date">경기 날짜</label>
                <input id="game-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="game-opp">상대 팀</label>
                <input
                  id="game-opp"
                  type="text"
                  value={opponent}
                  onChange={e => setOpponent(e.target.value)}
                  placeholder="예: 서울중"
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
                              <option key={p.id} value={p.id}>{p.backNumber}번 {p.name}</option>
                            ))}
                          </select>
                        </div>
                        <NumField id={`bat-${r.key}-ab`} label="타수" value={r.ab} onChange={v => patchBat(r.key, { ab: v })} />
                        <NumField id={`bat-${r.key}-hits`} label="안타" value={r.hits} onChange={v => patchBat(r.key, { hits: v })} />
                        <NumField id={`bat-${r.key}-hr`} label="홈런" value={r.hr} onChange={v => patchBat(r.key, { hr: v })} />
                        <NumField id={`bat-${r.key}-rbi`} label="타점" value={r.rbi} onChange={v => patchBat(r.key, { rbi: v })} />
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
                              <option key={p.id} value={p.id}>{p.backNumber}번 {p.name}</option>
                            ))}
                          </select>
                        </div>
                        <NumField id={`pit-${r.key}-ip`} label="이닝" value={r.ip} step="0.1" onChange={v => patchPit(r.key, { ip: v })} />
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
              <button type="submit" className="btn">경기 기록 저장</button>
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
          games.map(g => {
            const lost = g.result === "패";
            const won = g.result === "승";
            return (
              <div className="panel" key={g.id}>
                <div className="scoreline">
                  <div className="score">
                    <span className={lost ? "lose" : ""}>{g.scoreFor}</span>
                    <span className="sep">:</span>
                    <span className={won ? "lose" : ""}>{g.scoreAgainst}</span>
                  </div>
                  <div className="opp">
                    vs {g.opponent}
                    <small>{fmtDate(g.date)}</small>
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
                      <button
                        type="button"
                        className="icon-btn sm danger"
                        aria-label="경기 기록 삭제"
                        onClick={() => setConfirmId(g.id)}
                      >
                        <Icon.Trash />
                      </button>
                    )}
                  </div>
                </div>

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
                            <tr><th>선수</th><th className="num">타수</th><th className="num">안타</th><th className="num">홈런</th><th className="num">타점</th><th className="num">도루</th></tr>
                          </thead>
                          <tbody>
                            {g.batting.map(b => (
                              <tr key={b.playerId}>
                                <td className="name">{nameOf(b.playerId)}</td>
                                <td className="num">{b.ab}</td>
                                <td className="num">{b.hits}</td>
                                <td className="num">{b.hr}</td>
                                <td className="num">{b.rbi}</td>
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
                            <tr><th>선수</th><th className="num">이닝</th><th className="num">자책</th><th className="num">탈삼진</th><th className="num">볼넷</th></tr>
                          </thead>
                          <tbody>
                            {g.pitching.map(p => (
                              <tr key={p.playerId}>
                                <td className="name">{nameOf(p.playerId)}</td>
                                <td className="num">{p.ip}</td>
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
              </div>
            );
          })
        )
      )}

      {tab === "players" && (
        <div className="split even">
          <div className="panel">
            <div className="card-head">
              <h3>타격 누적</h3>
              <span className="meta">{batTotals.length}명</span>
            </div>
            {batTotals.length === 0 ? (
              <Empty>타격 기록이 없습니다.</Empty>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>선수</th><th className="num">타수</th><th className="num">안타</th><th className="num sorted">타율</th><th className="num">홈런</th><th className="num">타점</th><th className="num">도루</th></tr>
                  </thead>
                  <tbody>
                    {[...batTotals].sort((a, b) => b.avg - a.avg).map(r => (
                      <tr key={r.playerId}>
                        <td className="name">{nameOf(r.playerId)}</td>
                        <td className="num">{r.ab}</td>
                        <td className="num">{r.hits}</td>
                        <td className="num"><b>{fmtAvg(r.avg)}</b></td>
                        <td className="num">{r.hr}</td>
                        <td className="num">{r.rbi}</td>
                        <td className="num">{r.sb}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="panel">
            <div className="card-head">
              <h3>투구 누적</h3>
              <span className="meta">{pitTotals.length}명</span>
            </div>
            {pitTotals.length === 0 ? (
              <Empty>투구 기록이 없습니다.</Empty>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>선수</th><th className="num">이닝</th><th className="num">자책</th><th className="num sorted">ERA</th><th className="num">탈삼진</th><th className="num">볼넷</th></tr>
                  </thead>
                  <tbody>
                    {[...pitTotals].sort((a, b) => a.era - b.era).map(r => (
                      <tr key={r.playerId}>
                        <td className="name">{nameOf(r.playerId)}</td>
                        <td className="num">{r.ip}</td>
                        <td className="num">{r.er}</td>
                        <td className="num"><b>{r.era.toFixed(2)}</b></td>
                        <td className="num">{r.so}</td>
                        <td className="num">{r.bb}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "ranking" && (
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
      )}
    </>
  );
}
