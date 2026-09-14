import React, { useMemo, useState } from "react";
import { useStore } from "../../lib/store";
import { evaluatePlayer } from "../../lib/gpe";
import { GradeBadge, Medal, PageHead, Seg } from "../../components/ui";

type SortKey = "total" | "athletic" | "practical";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "total", label: "종합 순위" },
  { value: "athletic", label: "운동능력 순위" },
  { value: "practical", label: "실전 순위" },
];

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

  const colCls = (key: SortKey) => `num${sortKey === key ? " sorted" : " faded"}`;

  return (
    <>
      <PageHead
        title="팀 내 전체 순위"
        desc={<>팀 전체 선수의 종합·운동능력·실전 순위입니다. <b>신체 등급은 공개되지 않습니다.</b></>}
      />

      <div className="toolbar">
        <Seg value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} />
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>순위</th>
                <th>선수</th>
                <th>포지션</th>
                <th>학년</th>
                <th className={colCls("total")}>종합</th>
                <th className={colCls("athletic")}>운동능력</th>
                <th className={colCls("practical")}>실전</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, r }, i) => {
                const me = p.id === user?.playerId;
                return (
                  <tr key={p.id} className={me ? "me" : ""}>
                    <td><Medal rank={i + 1} /></td>
                    <td className="name">
                      <span className="flex gap8">
                        {p.name}
                        {me && <span className="pill brand">나</span>}
                      </span>
                    </td>
                    <td>{p.position}</td>
                    <td>{p.grade}학년</td>
                    <td className={colCls("total")}>
                      <span className="flex gap8">{r.total}<GradeBadge grade={r.totalGrade} size={20} /></span>
                    </td>
                    <td className={colCls("athletic")}>
                      <span className="flex gap8">{r.athletic.score}<GradeBadge grade={r.athletic.grade} size={20} /></span>
                    </td>
                    <td className={colCls("practical")}>
                      <span className="flex gap8">{r.practical.score}<GradeBadge grade={r.practical.grade} size={20} /></span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
