import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../../lib/store";
import { latest } from "../../lib/gpe";
import PlayerReport from "../../components/PlayerReport";
import { fmtDate } from "../../lib/format";
import { PageHead } from "../../components/ui";
import { Icon } from "../../components/icons";

export default function PlayerDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db } = useStore();
  const player = db.players.find(p => p.id === id);

  if (!player) {
    return (
      <PageHead
        title="선수를 찾을 수 없습니다"
        actions={<button className="btn secondary" onClick={() => nav("/c/players")}>목록으로</button>}
      />
    );
  }

  const s = latest(player);

  return (
    <>
      <PageHead
        title={player.name}
        desc={<>{player.position} · {player.grade}학년 · 등번호 {player.backNumber} · 측정 {player.records.length}회 (최근 {fmtDate(s.date)})</>}
        actions={
          <button className="btn ghost sm" onClick={() => nav("/c/players")}>
            <Icon.ArrowLeft />
            선수 목록
          </button>
        }
      />

      <div className="grid cols-4">
        <div className="card stat">
          <span className="label">신체</span>
          <span className="value sm">
            <span>
              {s.body.height}<span className="muted small">cm</span> / {s.body.weight}<span className="muted small">kg</span>
            </span>
          </span>
          <span className="hint">골격근 {s.body.skeletalMuscle}kg · 체지방 {s.body.bodyFat}% · 윙스팬 {s.body.wingspan}cm</span>
        </div>
        <div className="card stat">
          <span className="label">최근 1년 성장</span>
          <span className="value sm">
            <span>
              +{s.body.heightChange1y}<span className="muted small">cm</span> / +{s.body.weightChange1y}<span className="muted small">kg</span>
            </span>
          </span>
          <span className="hint">관절 가동범위 {s.body.jointROM}/100</span>
        </div>
        <div className="card stat">
          <span className="label">{s.practical.kind === "투수" ? "최고 구속" : "송구 속도"}</span>
          <span className="value sm">
            <span>
              {s.practical.maxVelo} <span className="muted small">km/h</span>
            </span>
          </span>
          <span className="hint">멀리던지기 {s.practical.longThrow}m · 커맨드 {s.practical.command}</span>
        </div>
        <div className="card stat">
          <span className="label">부상/통증 이력</span>
          <span className="value sm">{s.body.injuryHistory.trim() || "없음"}</span>
          <span className="hint">에러율 {s.practical.errorRate}%</span>
        </div>
      </div>

      <div className="mt12">
        <PlayerReport player={player} />
      </div>
    </>
  );
}
