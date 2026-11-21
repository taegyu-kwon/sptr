import React from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../../lib/store";
import type { SavedLineup } from "../../lib/types";
import { pitcherOf, spotLabel, spotOf } from "../../lib/lineup";
import { dday, fmtDate, fmtShort, todayISO, useSchedule } from "../../lib/schedule";
import { handLabel } from "../../lib/roster";
import { Empty, PageHead, Section } from "../../components/ui";
import LineupField from "../../components/LineupField";
import "../../styles/player.css";
import "../../styles/lineup.css";

/** 선수에게 보이는 라인업: 공개된 경기 전용 → 공개된 기본 라인업 */
function visibleLineup(lineups: SavedLineup[], teamId: string, gameId: string | null) {
  const pub = lineups.filter(l => l.teamId === teamId && l.published);
  const own = gameId ? pub.find(l => l.gameId === gameId) : undefined;
  if (own) return { lineup: own, source: "game" as const };
  const base = pub.find(l => l.gameId === null);
  return base ? { lineup: base, source: "default" as const } : undefined;
}

export default function PlanPage() {
  const { db, user } = useStore();
  const teamId = user!.teamId;
  const meId = user?.playerId ?? null;
  const players = db.players.filter(p => p.teamId === teamId);
  const { games, tournaments } = useSchedule(teamId);
  const today = todayISO();
  const official = games.filter(g => g.kind === "정식대회" && g.date >= today);

  const [params, setParams] = useSearchParams();
  const q = params.get("game");
  const gameId = q === "default" ? null : q && official.some(g => g.id === q) ? q : official[0]?.id ?? null;
  const game = official.find(g => g.id === gameId);
  const tn = game ? tournaments.find(t => t.id === game.tournamentId) : undefined;
  const vis = visibleLineup(db.lineups, teamId, gameId);
  const lu = vis?.lineup;
  const me = meId && lu ? spotOf(lu, meId) : null;
  const byId = (id?: string | null) => players.find(p => p.id === id);
  const spId = lu ? pitcherOf(lu) : null;
  const inLineup = new Set(lu ? [...lu.order.filter(Boolean).map(b => b!.playerId), ...(spId ? [spId] : [])] : []);
  const bench = lu ? players.filter(p => !inLineup.has(p.id)).sort((a, b) => a.backNumber - b.backNumber) : [];

  return (
    <>
      <PageHead
        title="예상 라인업"
        desc="감독·코치가 정식 경기용으로 미리 짠 라인업입니다. 경기 전에 바뀔 수 있고, 최종 라인업은 경기 전 미팅에서 발표합니다."
      />

      <Section>
        <div className="lu-targets" role="tablist" aria-label="경기 고르기">
          {official.map(g => {
            const v = visibleLineup(db.lineups, teamId, g.id);
            const s = meId && v ? spotOf(v.lineup, meId) : null;
            const on = g.id === gameId;
            return (
              <button key={g.id} type="button" role="tab" aria-selected={on} className={`lu-target${on ? " on" : ""}`} onClick={() => setParams({ game: g.id }, { replace: true })}>
                <span className="t">{fmtShort(g.date)} vs {g.opponent}</span>
                <span className="s">{g.round ?? "정식대회"} · {dday(today, g.date)}</span>
                <span className={`st${s && s.kind !== "bench" ? " own" : ""}`}>{!v ? "미공개" : s ? spotLabel(s) : "라인업 공개"}</span>
              </button>
            );
          })}
          <button type="button" role="tab" aria-selected={gameId === null} className={`lu-target${gameId === null ? " on" : ""}`} onClick={() => setParams({ game: "default" }, { replace: true })}>
            <span className="t">기본 라인업</span>
            <span className="s">정식 경기 공통</span>
            <span className="st">{visibleLineup(db.lineups, teamId, null) ? "공개" : "미공개"}</span>
          </button>
        </div>
      </Section>

      {!lu ? (
        <Section>
          <div className="panel">
            <Empty>아직 공개된 라인업이 없습니다. 감독·코치가 라인업을 공개하면 여기에 보입니다.</Empty>
          </div>
        </Section>
      ) : (
        <>
          {me && (
            <Section>
              <div className="panel hero">
                <div className="lu-me">
                  {me.kind === "batter" ? (
                    <div className="order-badge"><b>{me.order}</b><span>번 타자</span></div>
                  ) : (
                    <div className={`order-badge${me.kind === "bench" ? " off" : ""}`}><b>{me.kind === "pitcher" ? "P" : "–"}</b><span>{me.kind === "pitcher" ? "선발" : "벤치"}</span></div>
                  )}
                  <div className="info">
                    <div className="small muted">내 자리 · {game ? `${fmtDate(game.date)} vs ${game.opponent}` : "기본 라인업"}</div>
                    <div className={`big${me.kind === "bench" ? " dim" : ""}`}>
                      {me.kind === "batter" ? (me.pos === "투수" ? "선발 투수" : me.pos) : me.kind === "pitcher" ? "선발 투수" : "벤치 대기"}
                    </div>
                    <div className="sub">
                      {me.kind === "batter" && `${me.order}번 타순${me.pos === "지명타자" ? " · 수비에는 나가지 않습니다" : me.pos === "투수" ? " · 마운드에 오르고 타석에도 섭니다" : ""}`}
                      {me.kind === "pitcher" && "지명타자를 써서 타석에는 서지 않습니다."}
                      {me.kind === "bench" && "선발 명단에는 없지만 대타·대수비·구원으로 나갈 수 있으니 준비해 주세요."}
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          )}

          <Section
            title={game ? `${fmtDate(game.date)} vs ${game.opponent}` : "정식 경기 기본 라인업"}
            meta={
              game
                ? `${game.time} · ${game.place}${tn ? ` · ${tn.name}${game.round ? ` ${game.round}` : ""}` : ""}`
                : "경기별 라인업이 없으면 이 라인업을 씁니다"
            }
          >
            <div className="split wide-left">
              <div className="panel">
                <div className="card-head">
                  <h3>타순</h3>
                  <span className="meta">
                    {vis!.source === "game" ? "이 경기 전용" : game ? "기본 라인업 기준" : "기본"} · {lu.useDH ? "지명타자 있음" : "지명타자 없음"}
                  </span>
                </div>
                <div className="tbl-wrap">
                  <table className="tbl compact">
                    <thead>
                      <tr>
                        <th>타순</th>
                        <th>선수</th>
                        <th>수비</th>
                        <th className="num">투타</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lu.order.map((b, i) => {
                        const p = byId(b?.playerId);
                        const mine = !!p && p.id === meId;
                        return (
                          <tr key={i} className={`${mine ? "me" : ""}${!p ? " empty-slot" : ""}`}>
                            <td className="ord">{i + 1}</td>
                            <td className="name">
                              <span className="flex gap8">
                                {p ? `${p.name}` : "미정"}
                                {p && <span className="xs faint">#{p.backNumber}</span>}
                                {mine && <span className="pill brand">나</span>}
                              </span>
                            </td>
                            <td>{b ? b.pos : "-"}</td>
                            <td className="num faded">{p ? handLabel(p) ?? "-" : "-"}</td>
                          </tr>
                        );
                      })}
                      {lu.useDH && (
                        <tr className={byId(lu.pitcherId)?.id === meId && meId ? "me" : ""}>
                          <td className="ord" style={{ fontSize: 12 }}>선발</td>
                          <td className="name">
                            <span className="flex gap8">
                              {byId(lu.pitcherId)?.name ?? "미정"}
                              {byId(lu.pitcherId) && <span className="xs faint">#{byId(lu.pitcherId)!.backNumber}</span>}
                              {meId && lu.pitcherId === meId && <span className="pill brand">나</span>}
                            </span>
                          </td>
                          <td>투수</td>
                          <td className="num faded">{byId(lu.pitcherId) ? handLabel(byId(lu.pitcherId)!) ?? "-" : "-"}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel">
                <div className="card-head"><h3>수비 위치</h3></div>
                <LineupField lineup={lu} players={players} meId={meId} />
              </div>
            </div>
          </Section>

          {lu.memo && (
            <Section title="감독·코치 전달 사항">
              <div className="panel">
                <p className="lu-memo">{lu.memo}</p>
              </div>
            </Section>
          )}

          <Section title="벤치 대기" meta={`${bench.length}명`}>
            <div className="panel">
              {bench.length === 0 ? (
                <Empty>모든 선수가 선발 명단에 있습니다.</Empty>
              ) : (
                <div className="lu-bench">
                  {bench.map(p => (
                    <span key={p.id} className={`pill outline${p.id === meId ? " me" : ""}`}>#{p.backNumber} {p.name} · {p.positionDetail ?? p.position}</span>
                  ))}
                </div>
              )}
              <p className="xs faint" style={{ marginTop: 12, marginBottom: 0 }}>
                마지막 수정 {new Date(lu.updatedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                {lu.author ? ` · ${lu.author}` : ""}
              </p>
            </div>
          </Section>
        </>
      )}
    </>
  );
}
