import React from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../lib/store";
import { evaluatePlayer, latest } from "../../lib/gpe";
import { evaluatePlayerSbi, r1 } from "../../lib/sbi";
import { Avatar, Cell, Cells, Empty, GradeBadge, PageHead, RiskPill } from "../../components/ui";
import "../../styles/coach.css";

export default function PlayersPage() {
  const { db, user } = useStore();
  const nav = useNavigate();
  const players = db.players.filter(p => p.teamId === user?.teamId);

  const rows = players.map(p => ({ p, r: evaluatePlayer(p), s: latest(p), idx: evaluatePlayerSbi(p) }));
  const n = rows.length;
  const avg = n ? rows.reduce((sum, x) => sum + x.r.total, 0) / n : 0;
  const sCount = rows.filter(x => x.r.totalGrade === "S").length;
  const aCount = rows.filter(x => x.r.totalGrade === "A").length;
  const highRisk = rows.filter(x => x.r.injuryRisk.level === "높음").length;
  const midRisk = rows.filter(x => x.r.injuryRisk.level === "보통").length;

  return (
    <>
      <PageHead
        title="팀 내 선수 프로필"
        desc="선수를 클릭하면 프로필과 전체 데이터를 열람할 수 있습니다."
      />

      <div className="panel tint">
        <Cells n={4}>
          <Cell label="총원" value={n} unit="명" />
          <Cell label="팀 평균 종합" value={n ? avg.toFixed(1) : "-"} unit="점" sub="최신 측정 기준" />
          <Cell label="S·A 등급" value={sCount + aCount} unit="명" sub={`S ${sCount}명 · A ${aCount}명`} />
          <Cell label="부상위험 높음" value={highRisk} unit="명" sub={`보통 ${midRisk}명`} />
        </Cells>
      </div>

      <div className="panel">
        {n === 0 ? (
          <Empty>등록된 선수가 없습니다.</Empty>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl players-tbl">
              <thead>
                <tr>
                  <th>선수</th>
                  <th>신체</th>
                  <th className="num">종합</th>
                  <th>분야 등급</th>
                  <th className="num">SBI</th>
                  <th className="num">SMI</th>
                  <th className="num">최종 R</th>
                  <th>리스크</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, r, s, idx }) => (
                  <tr key={p.id} className="clickable" onClick={() => nav(`/c/players/${p.id}`)}>
                    <td>
                      <div className="who">
                        <Avatar name={p.name} size="sm" />
                        <div className="two">
                          <b>{p.name}</b>
                          <small>{p.position} · {p.grade}학년 · #{p.backNumber}</small>
                        </div>
                      </div>
                    </td>
                    <td className="dim">{s.body.height}cm / {s.body.weight}kg</td>
                    <td className="num">
                      <span className="flex gap8">
                        <b>{r.total}</b>
                        <GradeBadge grade={r.totalGrade} size={20} />
                      </span>
                    </td>
                    <td>
                      <span className="flex gap6">
                        <span title="신체"><GradeBadge grade={r.body.grade} size={20} /></span>
                        <span title="운동능력"><GradeBadge grade={r.athletic.grade} size={20} /></span>
                        <span title="실전"><GradeBadge grade={r.practical.grade} size={20} /></span>
                      </span>
                    </td>
                    <td className="num">{idx ? r1(idx.sbi) : "-"}</td>
                    <td className="num">{idx ? r1(idx.smi) : "-"}</td>
                    <td className="num">
                      <span className="brand-text strong">{idx ? r1(idx.finalR) : "-"}</span>
                    </td>
                    <td><RiskPill level={r.injuryRisk.level} /></td>
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
