import React, { useState } from "react";
import type { Player } from "../lib/types";
import { evaluatePlayerSbi, r1 } from "../lib/sbi";
import { ScoreBar } from "./ui";

export default function PlayerSbiCard({ player }: { player: Player }) {
  const res = evaluatePlayerSbi(player);
  const [detail, setDetail] = useState<"sbi" | "smi" | null>(null);

  if (!res) {
    return (
      <div className="card">
        <h3>SBI / SMI</h3>
        <div className="muted small">아직 등록된 SBI/SMI 측정 데이터가 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>SBI / SMI (U15)</h3>
      <div style={{ textAlign: "center", paddingTop: 2 }}>
        <div className="muted small" style={{ fontWeight: 700, letterSpacing: 1.5 }}>최종 점수 R</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: "var(--accent)", lineHeight: 1.15, letterSpacing: -1 }}>
          {r1(res.finalR)}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginTop: 14,
          alignItems: "stretch",
        }}
      >
        {([
          { key: "sbi" as const, label: "SBI", value: res.sbi },
          { key: "smi" as const, label: "SMI", value: res.smi },
        ]).map(item => {
          const on = detail === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setDetail(d => (d === item.key ? null : item.key))}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                background: on ? "var(--accent-dim)" : "var(--panel-2)",
                border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                padding: "12px 8px",
                minHeight: 72,
                cursor: "pointer",
                color: "inherit",
                fontFamily: "inherit",
              }}
            >
              <span className="label">{item.label}</span>
              <span style={{ color: "var(--accent)", fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {r1(item.value)}
              </span>
              <span className="muted" style={{ fontSize: 10.5 }}>{on ? "닫기" : "종목 그래프"}</span>
            </button>
          );
        })}
      </div>

      {detail === "sbi" && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <div className="muted small" style={{ fontWeight: 700, marginBottom: 8 }}>SBI 구성 종목</div>
          <ScoreBar label="스쿼트" score={Math.round(res.sSquat)} />
          <ScoreBar label="외발 데드리프트" score={Math.round(res.sDead)} />
          <ScoreBar label="푸쉬업" score={Math.round(res.sPush)} />
          <ScoreBar label="3대 스트렝스 평균" score={Math.round(res.avg)} />
          <ScoreBar label="버티컬 (정규화)" score={Math.round(res.normVert)} />
          <ScoreBar label="최고 구속 (정규화)" score={Math.round(res.normVelo)} />
          <ScoreBar label="스프린트 (정규화)" score={Math.round(res.normSprint)} />
        </div>
      )}
      {detail === "smi" && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <div className="muted small" style={{ fontWeight: 700, marginBottom: 8 }}>SMI 구성 종목</div>
          <ScoreBar label="제동력" score={Math.round(res.sBrake)} comment={`신장대비 ${r1(res.brakePct)}%`} />
          <ScoreBar label="가속효율" score={Math.round(res.sAccel)} comment={`비대칭 ${r1(res.accelPct)}%`} />
          <ScoreBar label="팔꿈치 폄 (M2)" score={Math.round(res.sElbow)} />
        </div>
      )}
    </div>
  );
}
