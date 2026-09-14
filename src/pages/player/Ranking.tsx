import React, { useMemo, useState } from "react";
import { useStore } from "../../lib/store";
import { evaluatePlayer } from "../../lib/gpe";
import { GradeBadge, Medal } from "../../components/ui";

type SortKey = "total" | "athletic" | "practical";

export default function RankingPage() {
  const { db, user } = useStore();
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const teamPlayers = db.players.filter(p => p.teamId === user?.teamId);

  const rows = useMemo(() => {
    const evaluated = teamPlayers.map(p => ({ p, r: evaluatePlayer(p) }));
    const val = (x: (typeof evaluated)[0]) =>
      sortKey === "total" ? x.r.total : sortKey === "athletic" ? x.r.athletic.score : x.r.practical.score;
    return evaluated.sort((a, b) => val(b) - val(a));
  }, [teamPlayers, sortKey]);

  return (
    <>
      <h1 className="page-title">팀 내 전체 순위</h1>
      <p className="page-desc">
        팀 전체 선수의 종합·운동능력·실전 순위입니다. <b>신체 등급은 공개되지 않습니다.</b>
      </p>

      <div className="tabs">
        <button className={sortKey === "total" ? "on" : ""} onClick={() => setSortKey("total")}>종합 순위</button>
        <button className={sortKey === "athletic" ? "on" : ""} onClick={() => setSortKey("athletic")}>운동능력 순위</button>
        <button className={sortKey === "practical" ? "on" : ""} onClick={() => setSortKey("practical")}>실전 순위</button>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>순위</th>
              <th>선수</th>
              <th>포지션</th>
              <th>학년</th>
              <th className="num">종합</th>
              <th className="num">운동능력</th>
              <th className="num">실전</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, r }, i) => (
              <tr key={p.id} className={p.id === user?.playerId ? "me" : ""}>
                <td><Medal rank={i + 1} /></td>
                <td>
                  <b>{p.name}</b>
                  {p.id === user?.playerId && <span className="pill info" style={{ marginLeft: 8 }}>나</span>}
                </td>
                <td>{p.position}</td>
                <td>{p.grade}학년</td>
                <td className="num">
                  <span className="flex" style={{ justifyContent: "flex-end", gap: 8 }}>
                    {r.total} <GradeBadge grade={r.totalGrade} size={24} />
                  </span>
                </td>
                <td className="num">
                  <span className="flex" style={{ justifyContent: "flex-end", gap: 8 }}>
                    {r.athletic.score} <GradeBadge grade={r.athletic.grade} size={24} />
                  </span>
                </td>
                <td className="num">
                  <span className="flex" style={{ justifyContent: "flex-end", gap: 8 }}>
                    {r.practical.score} <GradeBadge grade={r.practical.grade} size={24} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
