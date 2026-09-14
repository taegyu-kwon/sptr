import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../lib/store";
import { evaluatePlayer } from "../../lib/gpe";
import { GradeBadge, Medal } from "../../components/ui";

type SortKey = "total" | "body" | "athletic" | "practical";

const labels: Record<SortKey, string> = {
  total: "종합",
  body: "신체",
  athletic: "운동능력",
  practical: "실전",
};

export default function CoachRankingPage() {
  const { db, user } = useStore();
  const nav = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [posFilter, setPosFilter] = useState<string>("전체");

  const players = db.players.filter(p => p.teamId === user?.teamId);
  const positions = ["전체", "투수", "포수", "내야수", "외야수"];

  const rows = useMemo(() => {
    const filtered = posFilter === "전체" ? players : players.filter(p => p.position === posFilter);
    const evaluated = filtered.map(p => ({ p, r: evaluatePlayer(p) }));
    const val = (x: (typeof evaluated)[0]) =>
      sortKey === "total" ? x.r.total : x.r[sortKey].score;
    return evaluated.sort((a, b) => val(b) - val(a));
  }, [players, sortKey, posFilter]);

  return (
    <>
      <h1 className="page-title">분야별 팀 내 선수 랭킹</h1>
      <p className="page-desc">분야와 포지션별로 팀 내 선수 랭킹을 확인합니다. 코칭스태프에게는 신체 등급도 공개됩니다.</p>

      <div className="tabs">
        {(Object.keys(labels) as SortKey[]).map(k => (
          <button key={k} className={sortKey === k ? "on" : ""} onClick={() => setSortKey(k)}>
            {labels[k]}
          </button>
        ))}
      </div>
      <div className="tabs">
        {positions.map(pos => (
          <button key={pos} className={posFilter === pos ? "on" : ""} onClick={() => setPosFilter(pos)}>
            {pos}
          </button>
        ))}
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
              <th className="num">신체</th>
              <th className="num">운동능력</th>
              <th className="num">실전</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, r }, i) => (
              <tr key={p.id} className="clickable" onClick={() => nav(`/c/players/${p.id}`)}>
                <td><Medal rank={i + 1} /></td>
                <td><b>{p.name}</b></td>
                <td>{p.position}</td>
                <td>{p.grade}학년</td>
                {(["total", "body", "athletic", "practical"] as const).map(k => {
                  const score = k === "total" ? r.total : r[k].score;
                  const grade = k === "total" ? r.totalGrade : r[k].grade;
                  return (
                    <td className="num" key={k} style={{ opacity: sortKey === k ? 1 : 0.65 }}>
                      <span className="flex" style={{ justifyContent: "flex-end", gap: 8 }}>
                        {score} <GradeBadge grade={grade} size={24} />
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
