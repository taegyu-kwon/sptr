import React, { useMemo, useState } from "react";
import { useStore } from "../../lib/store";
import { latest } from "../../lib/gpe";
import type { Snapshot } from "../../lib/types";

type Section = "body" | "athletic" | "practical";

const bodyFields = [
  { key: "age", label: "나이 (만)", step: 1 },
  { key: "height", label: "키 (cm)", step: 0.1 },
  { key: "weight", label: "몸무게 (kg)", step: 0.1 },
  { key: "skeletalMuscle", label: "골격근량 (kg)", step: 0.1 },
  { key: "bodyFat", label: "체지방량 (%)", step: 0.1 },
  { key: "wingspan", label: "윙스팬 (cm)", step: 0.1 },
  { key: "legLength", label: "다리 길이 (cm)", step: 0.1 },
  { key: "heightChange1y", label: "최근 1년 키 변화 (cm)", step: 0.1 },
  { key: "weightChange1y", label: "최근 1년 몸무게 변화 (kg)", step: 0.1 },
  { key: "jointROM", label: "근위 관절 가동범위 (0-100)", step: 1 },
] as const;

const athleticFields = [
  { key: "benchPress", label: "가슴 — 벤치프레스 (kg)", step: 1 },
  { key: "shoulderPress", label: "어깨 — 숄더프레스 (kg)", step: 1 },
  { key: "rowPull", label: "등 — 로우 (kg)", step: 1 },
  { key: "squat", label: "하체 밀기 — 스쿼트 (kg)", step: 1 },
  { key: "deadlift", label: "하체 당기기 — 데드리프트 (kg)", step: 1 },
  { key: "dash60", label: "60야드 대시 (초)", step: 0.01 },
  { key: "dash30", label: "30야드 대시 (초)", step: 0.01 },
  { key: "run5kPace", label: "5km 러닝 페이스 (분/km)", step: 0.01 },
  { key: "plankMax", label: "플랭크 max (초)", step: 1 },
] as const;

export default function InputPage() {
  const { db, user, addSnapshot } = useStore();
  const player = db.players.find(p => p.id === user?.playerId)!;
  const last = latest(player);

  const [section, setSection] = useState<Section>("body");
  const [body, setBody] = useState({ ...last.body });
  const [athletic, setAthletic] = useState({ ...last.athletic });
  const [practical, setPractical] = useState({ ...last.practical });
  const [saved, setSaved] = useState(false);

  const isPitcher = practical.kind === "투수";
  const practicalFields = useMemo(
    () =>
      [
        { key: "maxVelo", label: isPitcher ? "최고 구속 (km/h)" : "송구 속도 (km/h)", step: 1 },
        { key: "longThrow", label: "멀리 던지기 (m)", step: 1 },
        { key: "command", label: isPitcher ? "커맨드 점수 (앱 측정, 0-100)" : "송구 정확도 (앱 측정, 0-100)", step: 1 },
        { key: "errorRate", label: isPitcher ? "에러율 — PFP 기준 (%)" : "에러율 — 펑고 기준 (%)", step: 0.1 },
      ] as const,
    [isPitcher]
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const snap: Snapshot = {
      date: new Date().toISOString().slice(0, 10),
      body: { ...body },
      athletic: { ...athletic },
      practical: { ...practical },
    };
    addSnapshot(player.id, snap);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const numInput = (
    value: number,
    onChange: (v: number) => void,
    step: number
  ) => (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ""}
      step={step}
      onChange={e => onChange(e.target.value === "" ? NaN : parseFloat(e.target.value))}
      required
    />
  );

  return (
    <>
      <h1 className="page-title">분야별 데이터 입력</h1>
      <p className="page-desc">
        측정한 데이터를 입력하면 새 측정 기록으로 저장되고, 능력치·성장 그래프에 즉시 반영됩니다. (최근 측정값이 미리 채워져 있습니다)
      </p>

      <div className="tabs">
        <button className={section === "body" ? "on" : ""} onClick={() => setSection("body")}>신체 데이터</button>
        <button className={section === "athletic" ? "on" : ""} onClick={() => setSection("athletic")}>운동능력 데이터</button>
        <button className={section === "practical" ? "on" : ""} onClick={() => setSection("practical")}>실전 데이터</button>
      </div>

      <form onSubmit={submit}>
        {section === "body" && (
          <div className="card">
            <h3>신체 데이터</h3>
            <div className="form-grid">
              {bodyFields.map(f => (
                <div className="field" key={f.key}>
                  <label>{f.label}</label>
                  {numInput(body[f.key], v => setBody(prev => ({ ...prev, [f.key]: v })), f.step)}
                </div>
              ))}
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>부상/통증 이력 (쉼표로 구분, 없으면 비워두기)</label>
                <input
                  value={body.injuryHistory}
                  onChange={e => setBody(prev => ({ ...prev, injuryHistory: e.target.value }))}
                  placeholder="예: 팔꿈치 통증, 햄스트링 염좌"
                />
              </div>
            </div>
          </div>
        )}

        {section === "athletic" && (
          <div className="card">
            <h3>운동능력 데이터</h3>
            <div className="form-grid">
              {athleticFields.map(f => (
                <div className="field" key={f.key}>
                  <label>{f.label}</label>
                  {numInput(athletic[f.key], v => setAthletic(prev => ({ ...prev, [f.key]: v })), f.step)}
                </div>
              ))}
            </div>
          </div>
        )}

        {section === "practical" && (
          <div className="card">
            <h3>실전 데이터 <span className="sub">({practical.kind} 기준)</span></h3>
            <div className="form-grid">
              <div className="field">
                <label>선수 유형</label>
                <select
                  value={practical.kind}
                  onChange={e => setPractical(prev => ({ ...prev, kind: e.target.value as "투수" | "야수" }))}
                >
                  <option value="투수">투수</option>
                  <option value="야수">야수</option>
                </select>
              </div>
              {practicalFields.map(f => (
                <div className="field" key={f.key}>
                  <label>{f.label}</label>
                  {numInput(practical[f.key] as number, v => setPractical(prev => ({ ...prev, [f.key]: v })), f.step)}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex mt16" style={{ gap: 12 }}>
          <button className="btn" type="submit">측정 기록 저장</button>
          {saved && <span className="ok-box">저장되었습니다. 능력치와 그래프에 반영됐어요.</span>}
        </div>
      </form>
    </>
  );
}
