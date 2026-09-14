import React from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../lib/store";
import { evaluatePlayer, latest } from "../../lib/gpe";
import { evaluatePlayerSbi, r1 } from "../../lib/sbi";
import { GradeBadge, RiskPill } from "../../components/ui";

export default function PlayersPage() {
  const { db, user } = useStore();
  const nav = useNavigate();
  const players = db.players.filter(p => p.teamId === user?.teamId);

  return (
    <>
      <h1 className="page-title">팀 내 선수 프로필</h1>
      <p className="page-desc">선수를 클릭하면 프로필과 전체 데이터를 열람할 수 있습니다. (총 {players.length}명)</p>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>No.</th>
              <th>선수</th>
              <th>포지션</th>
              <th>학년</th>
              <th className="num">키/몸무게</th>
              <th className="num">종합</th>
              <th className="num">SBI</th>
              <th className="num">SMI</th>
              <th className="num">R</th>
              <th className="num">신체</th>
              <th className="num">운동</th>
              <th className="num">실전</th>
              <th>리스크</th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => {
              const r = evaluatePlayer(p);
              const s = latest(p);
              const idx = evaluatePlayerSbi(p);
              return (
                <tr key={p.id} className="clickable" onClick={() => nav(`/c/players/${p.id}`)}>
                  <td className="muted">{p.backNumber}</td>
                  <td><b>{p.name}</b></td>
                  <td>{p.position}</td>
                  <td>{p.grade}학년</td>
                  <td className="num muted">{s.body.height}cm / {s.body.weight}kg</td>
                  <td className="num">
                    <span className="flex" style={{ justifyContent: "flex-end", gap: 8 }}>
                      {r.total} <GradeBadge grade={r.totalGrade} size={24} />
                    </span>
                  </td>
                  <td className="num">{idx ? r1(idx.sbi) : "-"}</td>
                  <td className="num">{idx ? r1(idx.smi) : "-"}</td>
                  <td className="num" style={{ color: "var(--accent)", fontWeight: 700 }}>{idx ? r1(idx.finalR) : "-"}</td>
                  <td className="num"><GradeBadge grade={r.body.grade} size={24} /></td>
                  <td className="num"><GradeBadge grade={r.athletic.grade} size={24} /></td>
                  <td className="num"><GradeBadge grade={r.practical.grade} size={24} /></td>
                  <td><RiskPill level={r.injuryRisk.level} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
