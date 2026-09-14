import React from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../lib/store";
import { evaluatePlayer, latest } from "../../lib/gpe";
import { evaluatePlayerSbi, r1 } from "../../lib/sbi";
import { Empty, GradeBadge, PageHead, RiskPill } from "../../components/ui";
import "../../styles/coach.css";

export default function PlayersPage() {
  const { db, user } = useStore();
  const nav = useNavigate();
  const players = db.players.filter(p => p.teamId === user?.teamId);

  return (
    <>
      <PageHead
        title="팀 내 선수 프로필"
        desc={<>선수를 클릭하면 프로필과 전체 데이터를 열람할 수 있습니다. 총 <b>{players.length}명</b></>}
      />

      <div className="card">
        {players.length === 0 ? (
          <Empty>등록된 선수가 없습니다.</Empty>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl players-tbl">
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
                  <th className="num">최종 R</th>
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
                      <td className="dim">{p.backNumber}</td>
                      <td className="name">{p.name}</td>
                      <td>{p.position}</td>
                      <td>{p.grade}학년</td>
                      <td className="dim num">{s.body.height}cm / {s.body.weight}kg</td>
                      <td className="num">
                        <span className="flex gap8">
                          {r.total}
                          <GradeBadge grade={r.totalGrade} size={20} />
                        </span>
                      </td>
                      <td className="num">{idx ? r1(idx.sbi) : "-"}</td>
                      <td className="num">{idx ? r1(idx.smi) : "-"}</td>
                      <td className="num">
                        <span className="brand-text strong">{idx ? r1(idx.finalR) : "-"}</span>
                      </td>
                      <td className="num"><GradeBadge grade={r.body.grade} size={20} /></td>
                      <td className="num"><GradeBadge grade={r.athletic.grade} size={20} /></td>
                      <td className="num"><GradeBadge grade={r.practical.grade} size={20} /></td>
                      <td><RiskPill level={r.injuryRisk.level} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
