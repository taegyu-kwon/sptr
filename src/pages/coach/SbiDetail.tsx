import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../../lib/store";
import { latest } from "../../lib/gpe";
import { fmtDate } from "../../lib/format";
import PlayerSbiCard from "../../components/PlayerSbiCard";
import { PageHead, Section } from "../../components/ui";
import { Icon } from "../../components/icons";
import "../../styles/coach.css";

export default function CoachSbiDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db } = useStore();
  const player = db.players.find(p => p.id === id);

  if (!player) {
    return (
      <PageHead
        title="선수를 찾을 수 없습니다"
        actions={<button type="button" className="btn secondary" onClick={() => nav("/c/sbi")}>리스트로</button>}
      />
    );
  }

  const s = latest(player);
  const m = player.sbiMetrics;

  return (
    <>
      <PageHead
        title={player.name}
        desc={<>{player.position} · {player.grade}학년 · 등번호 {player.backNumber}</>}
        actions={
          <button type="button" className="btn ghost sm" onClick={() => nav("/c/sbi")}>
            <Icon.ArrowLeft />
            SBI/SMI 리스트
          </button>
        }
      />

      <PlayerSbiCard player={player} />

      {m && (
        <Section title="측정 원자료" meta={m.date ? `측정일 ${fmtDate(m.date)}` : "측정일 미기록"}>
          <div className="panel">
            <div className="columns n2">
              <div className="col">
                <div className="col-head"><h4>신체 · 스피드</h4></div>
                <div className="kv">
                  <div className="kv-row"><span className="k">신장 / 체중</span><span className="v">{s.body.height}cm / {s.body.weight}kg</span></div>
                  <div className="kv-row"><span className="k">최고 구속</span><span className="v">{s.practical.maxVelo} km/h</span></div>
                  <div className="kv-row"><span className="k">10m 스프린트</span><span className="v">{m.sprint} 초</span></div>
                  <div className="kv-row"><span className="k">버티컬 점프</span><span className="v">{m.vertical} cm</span></div>
                </div>
              </div>
              <div className="col">
                <div className="col-head"><h4>근력 · 역학</h4></div>
                <div className="kv">
                  <div className="kv-row"><span className="k">스쿼트 / 외발 데드 / 푸쉬업</span><span className="v">{m.squatReps}개 / {m.deadReps}회 / {m.pushReps}개</span></div>
                  <div className="kv-row"><span className="k">제동력 착지거리</span><span className="v">{m.landDist} cm</span></div>
                  <div className="kv-row"><span className="k">가속효율 (상체만 / 전신)</span><span className="v">{m.upperOnly}m / {m.fullBody}m</span></div>
                  <div className="kv-row"><span className="k">팔꿈치 폄 Method 2</span><span className="v">{m.elbowThrow} m</span></div>
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}
    </>
  );
}
