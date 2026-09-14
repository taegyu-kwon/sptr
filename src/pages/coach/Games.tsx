import React, { useMemo, useState } from "react";
import { useStore } from "../../lib/store";
import { Cell, Cells, Empty, Medal, PageHead } from "../../components/ui";
import { fmtDate } from "../../lib/format";
import "../../styles/coach.css";

export default function GamesPage() {
  const { db, user } = useStore();
  const teamId = user!.teamId;
  const games = db.games.filter(g => g.teamId === teamId).sort((a, b) => b.date.localeCompare(a.date));
  const players = db.players.filter(p => p.teamId === teamId);
  const nameOf = (id: string) => players.find(p => p.id === id)?.name ?? "?";

  const [tab, setTab] = useState<"games" | "players" | "ranking">("games");

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
      playerId, ...s, era: s.ip > 0 ? (s.er * 9) / s.ip : 0,
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

  return (
    <>
      <PageHead title="시합 기록" desc="팀 기록, 선수 개별 기록, 각 부문 랭킹을 확인합니다." />

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
              <Cell label="경기당 득점" size="md" value={n ? (record.rf / n).toFixed(1) : "-"} unit="점" />
              <Cell label="경기당 실점" size="md" value={n ? (record.ra / n).toFixed(1) : "-"} unit="점" />
            </Cells>
          </div>
        </div>
      </div>

      <div className="tabs mt24">
        <button className={tab === "games" ? "on" : ""} onClick={() => setTab("games")}>경기별 기록</button>
        <button className={tab === "players" ? "on" : ""} onClick={() => setTab("players")}>선수 개별 기록</button>
        <button className={tab === "ranking" ? "on" : ""} onClick={() => setTab("ranking")}>부문별 랭킹</button>
      </div>

      {tab === "games" && (
        games.length === 0 ? (
          <Empty>등록된 경기 기록이 없습니다.</Empty>
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
