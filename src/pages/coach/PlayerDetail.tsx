import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../../lib/store";
import { latest } from "../../lib/gpe";
import PlayerReport from "../../components/PlayerReport";
import { fmtDate } from "../../lib/format";

export default function PlayerDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db } = useStore();
  const player = db.players.find(p => p.id === id);

  if (!player) {
    return (
      <>
        <h1 className="page-title">선수를 찾을 수 없습니다</h1>
        <button className="btn secondary" onClick={() => nav("/c/players")}>목록으로</button>
      </>
    );
  }

  const s = latest(player);

  return (
    <>
      <div className="flex between wrap">
        <div>
          <h1 className="page-title">{player.name}</h1>
          <p className="page-desc">
            {player.position} · {player.grade}학년 · 등번호 {player.backNumber} · 측정 {player.records.length}회 (최근 {fmtDate(s.date)})
          </p>
        </div>
        <button className="btn secondary sm" onClick={() => nav("/c/players")}>← 선수 목록</button>
      </div>

      <div className="grid cols-4">
        <div className="card stat">
          <span className="label">신체</span>
          <span className="value" style={{ fontSize: 18 }}>{s.body.height}cm / {s.body.weight}kg</span>
          <span className="hint">골격근 {s.body.skeletalMuscle}kg · 체지방 {s.body.bodyFat}% · 윙스팬 {s.body.wingspan}cm</span>
        </div>
        <div className="card stat">
          <span className="label">최근 1년 성장</span>
          <span className="value" style={{ fontSize: 18 }}>+{s.body.heightChange1y}cm / +{s.body.weightChange1y}kg</span>
          <span className="hint">관절 가동범위 {s.body.jointROM}/100</span>
        </div>
        <div className="card stat">
          <span className="label">{s.practical.kind === "투수" ? "최고 구속" : "송구 속도"}</span>
          <span className="value" style={{ fontSize: 18 }}>{s.practical.maxVelo} km/h</span>
          <span className="hint">멀리던지기 {s.practical.longThrow}m · 커맨드 {s.practical.command}</span>
        </div>
        <div className="card stat">
          <span className="label">부상/통증 이력</span>
          <span className="value" style={{ fontSize: 18 }}>{s.body.injuryHistory.trim() || "없음"}</span>
          <span className="hint">에러율 {s.practical.errorRate}%</span>
        </div>
      </div>

      <div className="mt16">
        <PlayerReport player={player} />
      </div>
    </>
  );
}
