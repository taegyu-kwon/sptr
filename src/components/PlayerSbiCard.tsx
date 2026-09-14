import React, { useState } from "react";
import type { Player } from "../lib/types";
import { evaluatePlayerSbi, r1 } from "../lib/sbi";
import { ScoreBar, Empty } from "./ui";

export default function PlayerSbiCard({ player }: { player: Player }) {
  const res = evaluatePlayerSbi(player);
  const [detail, setDetail] = useState<"sbi" | "smi" | null>(null);

  if (!res) {
    return (
      <div className="card">
        <div className="card-head">
          <h3>SBI / SMI</h3>
          <span className="meta">U15</span>
        </div>
        <Empty>아직 등록된 SBI/SMI 측정 데이터가 없습니다.</Empty>
      </div>
    );
  }

  const tiles = [
    { key: "sbi" as const, label: "SBI", value: res.sbi },
    { key: "smi" as const, label: "SMI", value: res.smi },
  ];

  return (
    <div className="card">
      <div className="card-head">
        <h3>SBI / SMI</h3>
        <span className="meta">U15</span>
      </div>

      <div className="hero-num">
        <div className="hn-label">최종 점수 R</div>
        <div className="hn-value">{r1(res.finalR)}</div>
        <div className="hn-sub">R = SBI/2 + SMI/2</div>
      </div>

      <div className="tile-row mt16">
        {tiles.map(item => {
          const on = detail === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={`tile${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => setDetail(d => (d === item.key ? null : item.key))}
            >
              <span className="t-label">{item.label}</span>
              <span className="t-value">{r1(item.value)}</span>
              <span className="t-sub">{on ? "닫기" : "종목 그래프"}</span>
            </button>
          );
        })}
      </div>

      {detail === "sbi" && (
        <>
          <div className="divider" />
          <div className="eyebrow mb8">SBI 구성 종목</div>
          <ScoreBar label="스쿼트" score={Math.round(res.sSquat)} />
          <ScoreBar label="외발 데드리프트" score={Math.round(res.sDead)} />
          <ScoreBar label="푸쉬업" score={Math.round(res.sPush)} />
          <ScoreBar label="3대 스트렝스 평균" score={Math.round(res.avg)} />
          <ScoreBar label="버티컬 (정규화)" score={Math.round(res.normVert)} />
          <ScoreBar label="최고 구속 (정규화)" score={Math.round(res.normVelo)} />
          <ScoreBar label="스프린트 (정규화)" score={Math.round(res.normSprint)} />
        </>
      )}
      {detail === "smi" && (
        <>
          <div className="divider" />
          <div className="eyebrow mb8">SMI 구성 종목</div>
          <ScoreBar label="제동력" score={Math.round(res.sBrake)} comment={`신장대비 ${r1(res.brakePct)}%`} />
          <ScoreBar label="가속효율" score={Math.round(res.sAccel)} comment={`비대칭 ${r1(res.accelPct)}%`} />
          <ScoreBar label="팔꿈치 폄 (M2)" score={Math.round(res.sElbow)} />
        </>
      )}
    </div>
  );
}
