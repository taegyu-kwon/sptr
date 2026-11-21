import React, { useMemo } from "react";
import { useStore } from "../../lib/store";
import PlayerReport from "../../components/PlayerReport";
import { latest } from "../../lib/gpe";
import { fmtDate } from "../../lib/format";
import { battingAvg, eraOf, fmtAvg, fmtEra, fmtIp, gamesInYear, playerBattingTotals, playerPitchingTotals } from "../../lib/stats";
import { Section, Cells, Cell } from "../../components/ui";

export default function StatsPage() {
  const { db, user } = useStore();
  const player = db.players.find(p => p.id === user?.playerId)!;
  const team = db.teams.find(t => t.id === player.teamId);
  const snap = latest(player);
  const isPitcher = snap.practical.kind === "투수";

  const year = new Date().getFullYear();
  const season = useMemo(() => {
    // 올해 경기만 — 코치 화면(선수 상세·시합 기록)의 시즌 성적과 같은 기준
    const games = gamesInYear(db.games.filter(g => g.teamId === player.teamId), year);
    return {
      bat: playerBattingTotals(games, player.id),
      pit: playerPitchingTotals(games, player.id),
      games: games.length,
    };
  }, [db.games, player.id, player.teamId, year]);

  const avgV = battingAvg(season.bat.hits, season.bat.ab);
  const eraV = eraOf(season.pit.er, season.pit.ip);
  const avg = avgV === null ? "-" : fmtAvg(avgV);
  const era = eraV === null ? "-" : fmtEra(eraV);

  const seasonCells: { k: string; v: React.ReactNode; unit?: string }[] = isPitcher
    ? [
        { k: "ERA", v: era },
        { k: "이닝", v: season.pit.outs > 0 ? fmtIp(season.pit.ip) : "-" },
        { k: "탈삼진", v: season.pit.so, unit: "K" },
        { k: "볼넷", v: season.pit.bb, unit: "BB" },
        { k: "타율", v: avg },
      ]
    : [
        { k: "타율", v: avg },
        { k: "안타", v: season.bat.hits, unit: "H" },
        { k: "홈런", v: season.bat.hr, unit: "HR" },
        { k: "타점", v: season.bat.rbi, unit: "RBI" },
        { k: "도루", v: season.bat.sb, unit: "SB" },
      ];

  const profileHeader = (
    <div className="profile">
      <div className="profile-num">{player.backNumber}</div>
      <div>
        <div className="profile-name">{player.name}</div>
        <div className="profile-meta">
          <span>{team?.name}</span>
          <span className="sep" />
          <span>{player.position}</span>
          <span className="sep" />
          <span>{player.grade}학년</span>
        </div>
      </div>
    </div>
  );

  const profileAndSeason = (
    <>
      <Section title="프로필">
        <div className="panel sub">
          <Cells n={5}>
            <Cell label="나이" value={snap.body.age} unit="세" size="sm" />
            <Cell
              label="신장 / 체중"
              size="sm"
              value={<>{snap.body.height}<span className="unit">cm</span> / {snap.body.weight}<span className="unit">kg</span></>}
            />
            <Cell label="윙스팬" value={snap.body.wingspan} unit="cm" size="sm" />
            <Cell label={isPitcher ? "최고 구속" : "송구 속도"} value={snap.practical.maxVelo} unit="km/h" size="sm" />
            <Cell label="최근 측정" value={fmtDate(snap.date)} size="sm" sub={`누적 ${player.records.length}회`} />
          </Cells>
        </div>
      </Section>

      <Section title={`${year} 시즌`} meta={`팀 ${season.games}경기 · ${isPitcher ? "투수" : "야수"} 기록`}>
        <div className="panel sub">
          <Cells n={5}>
            {seasonCells.map(c => (
              <Cell key={c.k} label={c.k} value={c.v} unit={c.unit} size="md" />
            ))}
          </Cells>
        </div>
      </Section>
    </>
  );

  return <PlayerReport player={player} header={profileHeader} after={profileAndSeason} />;
}
