import React, { useMemo, useState } from "react";
import type { GameRecord, GameType, Player } from "../lib/types";
import {
  GAME_TYPE_LABEL, battingAvg, eraOf, fmtAvg, fmtEra, fmtIp, gameTypeOf, k9Of, obpOf, opsOf, orDash,
  playerBattingTotals, playerPitchingTotals, slgOf, whipOf, type BatTotals, type PitTotals,
} from "../lib/stats";
import { fmtDate } from "../lib/format";
import { Cell, Cells, Empty, Seg, Section } from "./ui";

type View = "합산" | GameType;
const VIEWS: View[] = ["합산", "정식", "연습"];
const viewLabel = (v: View) => (v === "합산" ? "전체 합산" : GAME_TYPE_LABEL[v]);

/**
 * 한 선수의 올해 성적. games는 이미 팀·연도로 걸러진 경기 목록.
 * 정식·연습·합산을 한 표에 같이 보이고, 위 세그먼트로 요약 칸과 경기별 기록을 바꿔 본다.
 */
export default function SeasonStats({ player, games, year }: { player: Player; games: GameRecord[]; year: number }) {
  const [view, setView] = useState<View>("합산");

  const sets = useMemo(() => {
    const of = (v: View) => (v === "합산" ? games : games.filter(g => gameTypeOf(g) === v));
    return VIEWS.map(v => {
      const gs = of(v);
      return { v, games: gs, bat: playerBattingTotals(gs, player.id), pit: playerPitchingTotals(gs, player.id) };
    });
  }, [games, player.id]);

  const cur = sets.find(s => s.v === view)!;
  const isPitcher = player.position === "투수";
  const hasBat = sets[0].bat.games > 0;
  const hasPit = sets[0].pit.games > 0;

  const log = useMemo(
    () =>
      [...cur.games]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(g => ({ g, b: g.batting.find(x => x.playerId === player.id), p: g.pitching.find(x => x.playerId === player.id) }))
        .filter(x => x.b || x.p),
    [cur.games, player.id]
  );

  if (!hasBat && !hasPit) {
    return (
      <Section title={`${year}년 성적`} meta={`${games.length}경기 중 출전 없음`}>
        <div className="panel"><Empty>{year}년 출전 기록이 없습니다. '시합 기록'에서 경기를 등록하면 여기에 모입니다.</Empty></div>
      </Section>
    );
  }

  const b = cur.bat, p = cur.pit;

  return (
    <Section
      title={`${year}년 성적`}
      meta={`정식 ${sets[1].games.length} · 연습 ${sets[2].games.length}경기`}
      actions={<Seg small value={view} onChange={setView} options={VIEWS.map(v => ({ value: v, label: viewLabel(v) }))} />}
    >
      {/* 요약 — 선택한 구분 */}
      <div className="panel hero">
        <div className="eyebrow mb8">{viewLabel(view)}</div>
        {isPitcher && hasPit ? (
          <Cells n={5}>
            <Cell label="경기 / 이닝" size="md" value={`${p.games} / ${fmtIp(p.ip)}`} />
            <Cell label="ERA" size="md" value={orDash(eraOf(p.er, p.ip), fmtEra)} sub={`자책 ${p.er}`} />
            <Cell label="탈삼진" size="md" value={p.so} sub={`K/9 ${orDash(k9Of(p), v => v.toFixed(1))}`} />
            <Cell label="볼넷 / 피안타" size="md" value={`${p.bb} / ${p.hits}`} />
            <Cell label="WHIP" size="md" value={orDash(whipOf(p), fmtEra)} />
          </Cells>
        ) : (
          <Cells n={5}>
            <Cell label="경기 / 타수" size="md" value={`${b.games} / ${b.ab}`} />
            <Cell label="타율" size="md" value={orDash(battingAvg(b.hits, b.ab), fmtAvg)} sub={`안타 ${b.hits}`} />
            <Cell label="홈런 / 타점" size="md" value={`${b.hr} / ${b.rbi}`} sub={`2루타 ${b.doubles} · 3루타 ${b.triples}`} />
            <Cell label="출루율 / 장타율" size="md" value={`${orDash(obpOf(b), fmtAvg)} / ${orDash(slgOf(b), fmtAvg)}`} sub={`OPS ${orDash(opsOf(b), fmtAvg)}`} />
            <Cell label="도루 / 득점" size="md" value={`${b.sb} / ${b.runs}`} sub={`볼넷 ${b.bb} · 삼진 ${b.so}`} />
          </Cells>
        )}
      </div>

      {/* 구분별 비교 표 */}
      <div className={`${hasBat && hasPit ? "split even" : ""}`}>
        {hasBat && (
          <div className="panel">
            <div className="card-head"><h3>타격</h3><span className="meta">구분별</span></div>
            <div className="tbl-wrap">
              <table className="tbl compact season-tbl">
                <thead>
                  <tr><th className="kind">구분</th><th className="num">경기</th><th className="num">타수</th><th className="num">안타</th><th className="num">타율</th><th className="num">2루타</th><th className="num">3루타</th><th className="num">홈런</th><th className="num">타점</th><th className="num">득점</th><th className="num">도루</th><th className="num">볼넷</th><th className="num">삼진</th><th className="num">OPS</th></tr>
                </thead>
                <tbody>
                  {[sets[1], sets[2], sets[0]].map(s => <BatRow key={s.v} label={viewLabel(s.v)} t={s.bat} total={s.v === "합산"} />)}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {hasPit && (
          <div className="panel">
            <div className="card-head"><h3>투구</h3><span className="meta">구분별 · 이닝 ⅓ 단위</span></div>
            <div className="tbl-wrap">
              <table className="tbl compact season-tbl">
                <thead>
                  <tr><th className="kind">구분</th><th className="num">경기</th><th className="num">이닝</th><th className="num">자책</th><th className="num">ERA</th><th className="num">탈삼진</th><th className="num">볼넷</th><th className="num">피안타</th><th className="num">WHIP</th><th className="num">K/9</th></tr>
                </thead>
                <tbody>
                  {[sets[1], sets[2], sets[0]].map(s => <PitRow key={s.v} label={viewLabel(s.v)} t={s.pit} total={s.v === "합산"} />)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 경기별 기록 */}
      <div className="panel">
        <div className="card-head"><h3>경기별 기록</h3><span className="meta">{viewLabel(view)} · {log.length}경기 출전</span></div>
        {log.length === 0 ? (
          <Empty>이 구분에 출전 기록이 없습니다.</Empty>
        ) : (
          <div className="tbl-wrap season-log">
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>날짜</th><th>구분</th><th>상대</th><th>결과</th>
                  {hasBat && <><th className="num">타수</th><th className="num">안타</th><th className="num">홈런</th><th className="num">타점</th><th className="num">도루</th></>}
                  {hasPit && <><th className="num">이닝</th><th className="num">자책</th><th className="num">탈삼진</th><th className="num">볼넷</th></>}
                </tr>
              </thead>
              <tbody>
                {log.map(({ g, b: bl, p: pl }) => (
                  <tr key={g.id}>
                    <td className="dim">{fmtDate(g.date)}</td>
                    <td><span className={`pill ${gameTypeOf(g) === "정식" ? "brand" : "outline"}`}>{GAME_TYPE_LABEL[gameTypeOf(g)]}</span></td>
                    <td className="name">{g.opponent}</td>
                    <td><span className={`pill ${g.result === "승" ? "good" : g.result === "패" ? "bad" : "warn"}`}>{g.result} {g.scoreFor}:{g.scoreAgainst}</span></td>
                    {hasBat && (bl
                      ? <><td className="num">{bl.ab}</td><td className="num">{bl.hits}</td><td className="num">{bl.hr}</td><td className="num">{bl.rbi}</td><td className="num">{bl.sb}</td></>
                      : <td className="num dim" colSpan={5}>타석 없음</td>)}
                    {hasPit && (pl
                      ? <><td className="num">{fmtIp(pl.ip)}</td><td className="num">{pl.er}</td><td className="num">{pl.so}</td><td className="num">{pl.bb}</td></>
                      : <td className="num dim" colSpan={4}>등판 없음</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Section>
  );
}

function BatRow({ label, t, total }: { label: string; t: BatTotals; total?: boolean }) {
  return (
    <tr className={total ? "total" : ""}>
      <td className="kind">{label}</td>
      <td className="num">{t.games}</td>
      <td className="num">{t.ab}</td>
      <td className="num">{t.hits}</td>
      <td className="num"><b>{orDash(battingAvg(t.hits, t.ab), fmtAvg)}</b></td>
      <td className="num">{t.doubles}</td>
      <td className="num">{t.triples}</td>
      <td className="num">{t.hr}</td>
      <td className="num">{t.rbi}</td>
      <td className="num">{t.runs}</td>
      <td className="num">{t.sb}</td>
      <td className="num">{t.bb}</td>
      <td className="num">{t.so}</td>
      <td className="num">{orDash(opsOf(t), fmtAvg)}</td>
    </tr>
  );
}

function PitRow({ label, t, total }: { label: string; t: PitTotals; total?: boolean }) {
  return (
    <tr className={total ? "total" : ""}>
      <td className="kind">{label}</td>
      <td className="num">{t.games}</td>
      <td className="num">{fmtIp(t.ip)}</td>
      <td className="num">{t.er}</td>
      <td className="num"><b>{orDash(eraOf(t.er, t.ip), fmtEra)}</b></td>
      <td className="num">{t.so}</td>
      <td className="num">{t.bb}</td>
      <td className="num">{t.hits}</td>
      <td className="num">{orDash(whipOf(t), fmtEra)}</td>
      <td className="num">{orDash(k9Of(t), v => v.toFixed(1))}</td>
    </tr>
  );
}
