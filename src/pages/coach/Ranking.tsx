import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../lib/store";
import { evaluatePlayer } from "../../lib/gpe";
import { Empty, GradeBadge, Medal, PageHead, Seg } from "../../components/ui";

type SortKey = "total" | "body" | "athletic" | "practical";

const labels: Record<SortKey, string> = {
  total: "종합",
  body: "신체",
  athletic: "운동능력",
  practical: "실전",
};

const SORT_KEYS = Object.keys(labels) as SortKey[];

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
      <PageHead
        title="분야별 팀 내 선수 랭킹"
        desc="분야와 포지션별로 팀 내 선수 랭킹을 확인합니다. 코칭스태프에게는 신체 등급도 공개됩니다."
      />

      <div className="toolbar">
        <div className="group">
          <Seg
            value={sortKey}
            onChange={setSortKey}
            options={SORT_KEYS.map(k => ({ value: k, label: labels[k] }))}
          />
        </div>
        <div className="group">
          <Seg
            small
            value={posFilter}
            onChange={setPosFilter}
            options={positions.map(pos => ({ value: pos, label: pos }))}
          />
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <Empty>해당 포지션에 선수가 없습니다.</Empty>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>선수</th>
                  <th>포지션</th>
                  <th>학년</th>
                  {SORT_KEYS.map(k => (
                    <th key={k} className={`num${sortKey === k ? " sorted" : ""}`}>{labels[k]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, r }, i) => (
                  <tr key={p.id} className="clickable" onClick={() => nav(`/c/players/${p.id}`)}>
                    <td><Medal rank={i + 1} /></td>
                    <td className="name">{p.name}</td>
                    <td>{p.position}</td>
                    <td>{p.grade}학년</td>
                    {SORT_KEYS.map(k => {
                      const score = k === "total" ? r.total : r[k].score;
                      const grade = k === "total" ? r.totalGrade : r[k].grade;
                      return (
                        <td key={k} className={`num${sortKey === k ? "" : " faded"}`}>
                          <span className="flex gap8">
                            {score}
                            <GradeBadge grade={grade} size={20} />
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
