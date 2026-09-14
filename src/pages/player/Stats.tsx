import React, { useMemo } from "react";
import { useStore } from "../../lib/store";
import PlayerReport from "../../components/PlayerReport";
import { latest } from "../../lib/gpe";
import { fmtDate } from "../../lib/format";
import { Section, Cells, Cell } from "../../components/ui";

export default function StatsPage() {
  const { db, user } = useStore();
  const player = db.players.find(p => p.id === user?.playerId)!;
  const team = db.teams.find(t => t.id === player.teamId);
  const snap = latest(player);
  const isPitcher = snap.practical.kind === "투수";

  const season = useMemo(() => {
    const games = db.games.filter(g => g.teamId === player.teamId);
    const bat = { ab: 0, hits: 0, hr: 0, rbi: 0, sb: 0 };
    const pit = { ip: 0, er: 0, so: 0, bb: 0 };
    for (const g of games) {
      for (const b of g.batting) {
        if (b.playerId !== player.id) continue;
        bat.ab += b.ab; bat.hits += b.hits; bat.hr += b.hr; bat.rbi += b.rbi; bat.sb += b.sb;
      }
      for (const p of g.pitching) {
        if (p.playerId !== player.id) continue;
        pit.ip += p.ip; pit.er += p.er; pit.so += p.so; pit.bb += p.bb;
      }
    }
    return { bat, pit, games: games.length };
  }, [db.games, player.id, player.teamId]);

  const avg = season.bat.ab > 0 ? (season.bat.hits / season.bat.ab).toFixed(3).replace(/^0/, "") : "-";
  const era = season.pit.ip > 0 ? ((season.pit.er * 9) / season.pit.ip).toFixed(2) : "-";

  const seasonCells: { k: string; v: React.ReactNode; unit?: string }[] = isPitcher
    ? [
        { k: "ERA", v: era },
        { k: "이닝", v: season.pit.ip > 0 ? season.pit.ip.toFixed(1) : "-" },
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

      <Section title="2026 시즌" meta={`팀 경기 ${season.games}회 기준 · ${isPitcher ? "투수" : "야수"} 기록`}>
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
