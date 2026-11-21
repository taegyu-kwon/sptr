import React, { useMemo, useState } from "react";
import { useStore } from "../../lib/store";
import { evaluatePlayer } from "../../lib/gpe";
import { Avatar, Cells, Cell, GradeBadge, Medal, PageHead, Seg } from "../../components/ui";
import "../../styles/player.css";

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

  const myIndex = rows.findIndex(x => x.p.id === user?.playerId);
  const mine = myIndex >= 0 ? rows[myIndex] : null;
  const sortLabel = SORT_OPTIONS.find(o => o.value === sortKey)?.label ?? "";

  const colCls = (key: SortKey) => `num${sortKey === key ? " sorted" : " faded"}`;
  const scoreCell = (key: SortKey, score: number, grade: Parameters<typeof GradeBadge>[0]["grade"]) => (
    <td className={colCls(key)}>
      <span className="flex gap8">
        {sortKey === key ? <b>{score}</b> : score}
        <GradeBadge grade={grade} size={20} />
      </span>
    </td>
  );

  return (
    <>
      <PageHead
        title="팀 내 전체 순위"
        desc={<>팀 전체 선수의 종합·운동능력·실전 순위입니다. <b>신체 등급은 공개되지 않습니다.</b></>}
      />

      <div className="toolbar">
        <Seg value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} />
      </div>

      {mine && (
        <div className="panel tint">
          <div className="rank-hero">
            <div>
              <span className="eyebrow">내 {sortLabel}</span>
              <div className="display brand">
                {myIndex + 1}위
                <span className="unit">/ {rows.length}명</span>
              </div>
            </div>
            <Cells n={3}>
              <Cell label="종합" value={mine.r.total} grade={mine.r.totalGrade} size="md" />
              <Cell label="운동능력" value={mine.r.athletic.score} grade={mine.r.athletic.grade} size="md" />
              <Cell label="실전" value={mine.r.practical.score} grade={mine.r.practical.grade} size="md" />
            </Cells>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="tbl-wrap">
          <table className="tbl rank-tbl">
            <thead>
              <tr>
                <th className="rank-cell">순위</th>
                <th>선수</th>
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
                    <td className="rank-cell"><Medal rank={i + 1} /></td>
                    <td>
                      <span className="who">
                        <Avatar name={p.name} size="sm" tone={me ? "brand" : undefined} />
                        <span className="two">
                          <span className="name">{p.name}</span>
                          <small>{p.position} · {p.grade}학년</small>
                        </span>
                      </span>
                    </td>
                    {scoreCell("total", r.total, r.totalGrade)}
                    {scoreCell("athletic", r.athletic.score, r.athletic.grade)}
                    {scoreCell("practical", r.practical.score, r.practical.grade)}
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
