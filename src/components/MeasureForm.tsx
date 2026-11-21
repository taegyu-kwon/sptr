import React, { useMemo, useState } from "react";
import type { PlayerKind, Snapshot } from "../lib/types";
import { todayISO } from "../lib/schedule";
import { Notice } from "./ui";
import "../styles/measure.css";

type SectionKey = "body" | "athletic" | "practical";

export const BODY_FIELDS = [
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

export const ATHLETIC_FIELDS = [
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

export const practicalFieldsOf = (kind: PlayerKind) => {
  const isPitcher = kind === "투수";
  return [
    { key: "maxVelo", label: isPitcher ? "최고 구속 (km/h)" : "송구 속도 (km/h)", step: 1 },
    { key: "longThrow", label: "멀리 던지기 (m)", step: 1 },
    { key: "command", label: isPitcher ? "커맨드 점수 (앱 측정, 0-100)" : "송구 정확도 (앱 측정, 0-100)", step: 1 },
    { key: "errorRate", label: isPitcher ? "에러율 — PFP 기준 (%)" : "에러율 — 펑고 기준 (%)", step: 0.1 },
  ] as const;
};

const TABS: { key: SectionKey; label: string }[] = [
  { key: "body", label: "신체 데이터" },
  { key: "athletic", label: "운동능력 데이터" },
  { key: "practical", label: "실전 데이터" },
];

/**
 * 측정 기록 입력 폼(신체·운동능력·실전) — 감독·코치가 선수 상세에서 쓴다.
 * initial 값으로 미리 채우고, 저장하면 onSubmit에 Snapshot을 넘긴다.
 */
export default function MeasureForm({
  initial, initialDate, takenDates, hint, submitLabel, onSubmit, onCancel,
}: {
  initial: Snapshot;
  /** 측정일 초기값 */
  initialDate: string;
  /** 이미 기록이 있는 날짜(수정 중인 기록의 날짜는 빼고 넘긴다) */
  takenDates: string[];
  /** 머리글 옆 안내(예: 직전 기록 값이 채워져 있습니다) */
  hint: string;
  submitLabel: string;
  onSubmit: (snap: Snapshot) => void;
  onCancel: () => void;
}) {
  const [section, setSection] = useState<SectionKey>("body");
  const [date, setDate] = useState(initialDate);
  const [body, setBody] = useState({ ...initial.body });
  const [athletic, setAthletic] = useState({ ...initial.athletic });
  const [practical, setPractical] = useState({ ...initial.practical });
  const [error, setError] = useState<string | null>(null);

  const practicalFields = useMemo(() => practicalFieldsOf(practical.kind), [practical.kind]);

  /** 보이지 않는 탭은 브라우저 필수 검사를 받지 않으므로 세 탭을 직접 검사한다 */
  const firstEmpty = (): { section: SectionKey; label: string } | null => {
    for (const f of BODY_FIELDS) if (!Number.isFinite(body[f.key])) return { section: "body", label: f.label };
    for (const f of ATHLETIC_FIELDS) if (!Number.isFinite(athletic[f.key])) return { section: "athletic", label: f.label };
    for (const f of practicalFields)
      if (!Number.isFinite(practical[f.key])) return { section: "practical", label: f.label };
    return null;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("측정일을 선택하세요.");
    if (date > todayISO()) return setError("측정일은 오늘 이후로 지정할 수 없습니다.");
    if (takenDates.includes(date))
      return setError("같은 측정일의 기록이 이미 있습니다. 아래 측정 이력에서 그 기록을 수정하세요.");
    const empty = firstEmpty();
    if (empty) {
      setSection(empty.section);
      return setError(`'${empty.label}' 값이 비어 있습니다. 입력한 뒤 저장하세요.`);
    }
    setError(null);
    onSubmit({
      date,
      body: { ...body, injuryHistory: body.injuryHistory.trim() },
      athletic: { ...athletic },
      practical: { ...practical },
    });
  };

  const numInput = (label: string, value: number, onChange: (v: number) => void, step: number) => (
    <input
      type="number"
      aria-label={label}
      value={Number.isFinite(value) ? value : ""}
      step={step}
      onChange={e => onChange(e.target.value === "" ? NaN : parseFloat(e.target.value))}
    />
  );

  return (
    <form onSubmit={submit} className="measure-form" noValidate>
      <div className="measure-date">
        <div className="field">
          <label htmlFor="measure-date">측정일</label>
          <input id="measure-date" type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} />
        </div>
        <span className="small faint">{hint}</span>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={section === t.key}
            className={section === t.key ? "on" : ""}
            onClick={() => setSection(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {section === "body" && (
        <div className="form-grid">
          {BODY_FIELDS.map(f => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              {numInput(f.label, body[f.key], v => setBody(prev => ({ ...prev, [f.key]: v })), f.step)}
            </div>
          ))}
          <div className="field span-all">
            <label>부상/통증 이력 (쉼표로 구분, 없으면 비워두기)</label>
            <input
              value={body.injuryHistory}
              onChange={e => setBody(prev => ({ ...prev, injuryHistory: e.target.value }))}
              placeholder="예: 팔꿈치 통증, 햄스트링 염좌"
            />
          </div>
        </div>
      )}

      {section === "athletic" && (
        <div className="form-grid">
          {ATHLETIC_FIELDS.map(f => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              {numInput(f.label, athletic[f.key], v => setAthletic(prev => ({ ...prev, [f.key]: v })), f.step)}
            </div>
          ))}
        </div>
      )}

      {section === "practical" && (
        <div className="form-grid">
          <div className="field">
            <label>선수 유형</label>
            <select
              value={practical.kind}
              onChange={e => setPractical(prev => ({ ...prev, kind: e.target.value as PlayerKind }))}
            >
              <option value="투수">투수</option>
              <option value="야수">야수</option>
            </select>
          </div>
          {practicalFields.map(f => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              {numInput(f.label, practical[f.key], v => setPractical(prev => ({ ...prev, [f.key]: v })), f.step)}
            </div>
          ))}
        </div>
      )}

      {error && <Notice kind="error" className="mt16">{error}</Notice>}
      <div className="flex wrap gap12 mt16">
        <button className="btn" type="submit">{submitLabel}</button>
        <button className="btn ghost" type="button" onClick={onCancel}>취소</button>
      </div>
    </form>
  );
}

/* ---------- 보기 전용: 측정 기록 1건의 전체 값 ---------- */

const unitOf = (label: string) => /\(([^)]+)\)\s*$/.exec(label)?.[1] ?? "";
const nameOf = (label: string) => label.replace(/\s*\([^)]*\)\s*$/, "");
/** "키 (cm)" → 값 뒤에 단위. 0-100 점수·"만" 같은 설명은 단위로 붙이지 않는다 */
const withUnit = (label: string, v: number) => {
  const u = unitOf(label);
  if (!u || /0-100/.test(u)) return String(v);
  if (u === "만") return `${v}세`;
  return `${v} ${u}`;
};

export function SnapshotDetail({ snap }: { snap: Snapshot }) {
  const practicalFields = practicalFieldsOf(snap.practical.kind);
  const injury = snap.body.injuryHistory.trim();
  return (
    <div className="columns n3 measure-detail">
      <div className="col">
        <div className="col-head"><h4>신체</h4></div>
        <div className="kv">
          {BODY_FIELDS.map(f => (
            <div className="kv-row" key={f.key}>
              <span className="k">{nameOf(f.label)}</span>
              <span className="v">{withUnit(f.label, snap.body[f.key])}</span>
            </div>
          ))}
          <div className="kv-row">
            <span className="k">부상/통증 이력</span>
            <span className="v">{injury || "없음"}</span>
          </div>
        </div>
      </div>
      <div className="col">
        <div className="col-head"><h4>운동능력</h4></div>
        <div className="kv">
          {ATHLETIC_FIELDS.map(f => (
            <div className="kv-row" key={f.key}>
              <span className="k">{nameOf(f.label)}</span>
              <span className="v">{withUnit(f.label, snap.athletic[f.key])}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="col">
        <div className="col-head"><h4>실전 ({snap.practical.kind})</h4></div>
        <div className="kv">
          {practicalFields.map(f => (
            <div className="kv-row" key={f.key}>
              <span className="k">{nameOf(f.label)}</span>
              <span className="v">{withUnit(f.label, snap.practical[f.key])}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
