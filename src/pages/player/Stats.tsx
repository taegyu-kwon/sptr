import React, { useMemo } from "react";
import { useStore } from "../../lib/store";
import PlayerReport from "../../components/PlayerReport";
import { latest } from "../../lib/gpe";
import { fmtDate } from "../../lib/format";

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

  const seasonCells = isPitcher
    ? [
        { k: "ERA", v: era },
        { k: "이닝", v: season.pit.ip > 0 ? season.pit.ip.toFixed(1) : "-" },
        { k: "탈삼진", v: season.pit.so },
        { k: "볼넷", v: season.pit.bb },
        { k: "타율", v: avg },
      ]
    : [
        { k: "타율", v: avg },
        { k: "안타", v: season.bat.hits },
        { k: "홈런", v: season.bat.hr },
        { k: "타점", v: season.bat.rbi },
        { k: "도루", v: season.bat.sb },
      ];

  return (
    <>
      <div className="card profile-hero">
        <div className="profile-main">
          <div className="profile-num">{player.backNumber}</div>
          <div>
            <div className="profile-name">{player.name}</div>
            <div className="profile-meta">
              {team?.name} · {player.position} · {player.grade}학년
            </div>
          </div>
        </div>
        <div className="bio-grid">
          <div className="bio-item"><span className="k">나이</span><span className="v">{snap.body.age}세</span></div>
          <div className="bio-item"><span className="k">신장 / 체중</span><span className="v">{snap.body.height}cm / {snap.body.weight}kg</span></div>
          <div className="bio-item"><span className="k">윙스팬</span><span className="v">{snap.body.wingspan}cm</span></div>
          <div className="bio-item"><span className="k">{isPitcher ? "최고 구속" : "송구 속도"}</span><span className="v">{snap.practical.maxVelo}km/h</span></div>
          <div className="bio-item"><span className="k">최근 측정</span><span className="v">{fmtDate(snap.date)}</span></div>
        </div>
        <div className="season-strip">
          <span className="season-title">2026 시즌</span>
          {seasonCells.map(c => (
            <div className="bio-item" key={c.k}>
              <span className="k">{c.k}</span>
              <span className="v">{c.v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt16">
        <PlayerReport player={player} />
      </div>
    </>
  );
}
