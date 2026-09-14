import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../lib/store";
import { evaluatePlayer } from "../../lib/gpe";
import type { GpeResult } from "../../lib/gpe";
import { Avatar, Empty, GradeBadge, Medal, PageHead, Seg } from "../../components/ui";
import "../../styles/coach.css";

type SortKey = "total" | "body" | "athletic" | "practical";

const labels: Record<SortKey, string> = {
  total: "종합",
  body: "신체",
  athletic: "운동능력",
  practical: "실전",
};

const SORT_KEYS = Object.keys(labels) as SortKey[];

const scoreOf = (r: GpeResult, k: SortKey) => (k === "total" ? r.total : r[k].score);
const gradeOf = (r: GpeResult, k: SortKey) => (k === "total" ? r.totalGrade : r[k].grade);

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
    return evaluated.sort((a, b) => scoreOf(b.r, sortKey) - scoreOf(a.r, sortKey));
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

      {rows.length === 0 ? (
        <div className="panel">
          <Empty>해당 포지션에 선수가 없습니다.</Empty>
        </div>
      ) : (
        <>
          <div className="grid cols-3 top3">
            {rows.slice(0, 3).map(({ p, r }, i) => (
              <div className="panel sub" key={p.id}>
                <div className="flex gap12">
                  <Medal rank={i + 1} />
                  <Avatar name={p.name} />
                  <div className="grow">
                    <div className="strong">{p.name}</div>
                    <div className="faint xs">{p.position} · {p.grade}학년</div>
                  </div>
                  <span className="display sm">{scoreOf(r, sortKey)}</span>
                  <GradeBadge grade={gradeOf(r, sortKey)} />
                </div>
              </div>
            ))}
          </div>

          <div className="panel mt16">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="rank-cell">순위</th>
                    <th>선수</th>
                    {SORT_KEYS.map(k => (
                      <th key={k} className={`num${sortKey === k ? " sorted" : ""}`}>{labels[k]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, r }, i) => (
                    <tr key={p.id} className="clickable" onClick={() => nav(`/c/players/${p.id}`)}>
                      <td><Medal rank={i + 1} /></td>
                      <td>
                        <div className="who">
                          <Avatar name={p.name} size="sm" />
                          <div className="two">
                            <b>{p.name}</b>
                            <small>{p.position} · {p.grade}학년</small>
                          </div>
                        </div>
                      </td>
                      {SORT_KEYS.map(k => (
                        <td key={k} className={`num${sortKey === k ? "" : " faded"}`}>
                          <span className="flex gap8">
                            {sortKey === k ? <b>{scoreOf(r, k)}</b> : scoreOf(r, k)}
                            <GradeBadge grade={gradeOf(r, k)} size={20} />
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
