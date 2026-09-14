import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../../lib/store";
import { latest } from "../../lib/gpe";
import { evaluatePlayerSbi, r1 } from "../../lib/sbi";
import PlayerSbiCard from "../../components/PlayerSbiCard";

export default function CoachSbiDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db } = useStore();
  const player = db.players.find(p => p.id === id);

  if (!player) {
    return (
      <>
        <h1 className="page-title">선수를 찾을 수 없습니다</h1>
        <button className="btn secondary" onClick={() => nav("/c/sbi")}>리스트로</button>
      </>
    );
  }

  const s = latest(player);
  const idx = evaluatePlayerSbi(player);
  const m = player.sbiMetrics;

  return (
    <>
      <div className="flex between wrap">
        <div>
          <h1 className="page-title">{player.name}</h1>
          <p className="page-desc">
            {player.position} · {player.grade}학년 · 등번호 {player.backNumber}
            {idx && <> · 최종 R <b style={{ color: "var(--accent)" }}>{r1(idx.finalR)}</b></>}
          </p>
        </div>
        <button className="btn secondary sm" onClick={() => nav("/c/sbi")}>← SBI/SMI 리스트</button>
      </div>

      <PlayerSbiCard player={player} />

      {m && (
        <div className="card mt16">
          <h3>측정 원자료</h3>
          <table className="tbl">
            <tbody>
              <tr><td className="muted">신장 / 체중</td><td className="num"><b>{s.body.height}cm / {s.body.weight}kg</b></td></tr>
              <tr><td className="muted">최고 구속</td><td className="num"><b>{s.practical.maxVelo} km/h</b></td></tr>
              <tr><td className="muted">10m 스프린트</td><td className="num"><b>{m.sprint} 초</b></td></tr>
              <tr><td className="muted">버티컬 점프</td><td className="num"><b>{m.vertical} cm</b></td></tr>
              <tr><td className="muted">스쿼트 / 외발 데드 / 푸쉬업</td><td className="num"><b>{m.squatReps}개 / {m.deadReps}회 / {m.pushReps}개</b></td></tr>
              <tr><td className="muted">제동력 착지거리</td><td className="num"><b>{m.landDist} cm</b></td></tr>
              <tr><td className="muted">가속효율 (상체만 / 전신)</td><td className="num"><b>{m.upperOnly}m / {m.fullBody}m</b></td></tr>
              <tr><td className="muted">팔꿈치 폄 Method 2</td><td className="num"><b>{m.elbowThrow} m</b></td></tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
