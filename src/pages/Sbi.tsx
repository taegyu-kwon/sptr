import React, { useMemo, useState } from "react";
import "../styles/sbi.css";
import { useStore } from "../lib/store";
import { latest } from "../lib/gpe";
import { ScoreBar, ScoreRing, PageHead, Section, Notice } from "../components/ui";

const clamp100 = (v: number) => Math.max(0, Math.min(100, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

// ---------- U15 스트렝스 점수 환산 ----------
function scoreSquat(x: number) {
  if (x >= 50) return 100;
  if (x >= 40) return 70 + (x - 40) * 3;
  if (x >= 30) return 40 + (x - 30) * 3;
  return x * 1.3;
}
function scoreDead(x: number) {
  if (x >= 13) return 100;
  if (x >= 9) return 70 + (x - 9) * 7.5;
  if (x >= 6) return 40 + (x - 6) * 10;
  return x * 6.5;
}
function scorePush(x: number) {
  if (x >= 40) return 100;
  if (x >= 29) return 70 + (x - 29) * 2.7;
  if (x >= 20) return 40 + (x - 20) * 3.3;
  return x * 1.9;
}

// ---------- SMI 점수 환산 ----------
/** 제동력: 신장대비 % */
function scoreBrake(pct: number) {
  if (pct >= 300) return 100;
  if (pct >= 290) return 70 + (pct - 290) * 3;
  if (pct >= 240) return 40 + (pct - 240) * 0.6;
  return pct * (40 / 240);
}
/** 가속효율: 비대칭비율 % */
function scoreAccel(pct: number) {
  if (pct >= 140) return 100;
  if (pct >= 139) return 70 + (pct - 139) * 30;
  if (pct >= 115) return 40 + (pct - 115) * (30 / 24);
  return pct * (40 / 115);
}
/** 팔꿈치 폄 속도 Method 2: 무릎 꿇고 메디신볼 비거리(m) */
function scoreElbowM2(m: number) {
  if (m >= 8.5) return 100;
  if (m >= 8) return 70 + (m - 8) * 60;
  if (m >= 6) return 40 + (m - 6) * 15;
  return m * (40 / 6);
}

const C_U15 = 5.1;

const LOADS: Record<string, { squat: number; dead: number; push: number }> = {
  "1": { squat: 0.25, dead: 0.3, push: 0 },
  "2": { squat: 0.33, dead: 0.4, push: 5 },
  "3": { squat: 0.4, dead: 0.5, push: 10 },
};

const NORM = { vertMax: 90, veloMax: 170, sprintBest: 1.2, sprintWorst: 2.2 };
const AXES = ["스쿼트", "데드리프트", "푸쉬업", "버티컬", "최고 구속", "스프린트"];

function Radar({ values }: { values: (number | null)[] }) {
  const CX = 210, CY = 185, R = 120;
  const pt = (i: number, ratio: number): [number, number] => {
    const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return [CX + Math.cos(a) * R * ratio, CY + Math.sin(a) * R * ratio];
  };
  const hasAll = values.every(v => v !== null);
  return (
    <svg className="radar" width="420" height="380" viewBox="0 0 420 380" aria-hidden="true">
      {[0.25, 0.5, 0.75, 1].map(lv => (
        <polygon
          key={lv}
          points={Array.from({ length: 6 }, (_, i) => pt(i, lv).join(",")).join(" ")}
          fill="none" stroke="var(--line-2)" strokeWidth={1}
        />
      ))}
      {Array.from({ length: 6 }, (_, i) => {
        const p = pt(i, 1);
        return <line key={i} x1={CX} y1={CY} x2={p[0]} y2={p[1]} stroke="var(--line-2)" strokeWidth={1} />;
      })}
      {hasAll && (
        <>
          <polygon
            points={values.map((v, i) => pt(i, clamp100(v!) / 100).join(",")).join(" ")}
            fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth={2}
          />
          {values.map((v, i) => {
            const p = pt(i, clamp100(v!) / 100);
            return <circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill="var(--brand)" />;
          })}
        </>
      )}
      {AXES.map((label, i) => {
        const p = pt(i, 1.2);
        return (
          <g key={label}>
            <text x={p[0]} y={p[1] - 5} textAnchor="middle" fill="var(--fg-3)" fontSize={11} fontWeight={600} fontFamily="inherit">
              {label}
            </text>
            <text x={p[0]} y={p[1] + 12} textAnchor="middle" fill="var(--fg)" fontSize={13} fontWeight={700} fontFamily="inherit">
              {values[i] === null ? "-" : Math.round(clamp100(values[i]!))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 레이더 옆 키-값 한 줄: 정규화 점수 + (측정 원값) */
function KvScore({ k, score, raw }: { k: string; score: number | null; raw?: string }) {
  return (
    <div className="kv-row">
      <span className="k">{k}</span>
      <span className="v">
        {score === null ? "-" : Math.round(clamp100(score))}
        {raw && <small className="faint"> {raw}</small>}
      </span>
    </div>
  );
}

const parse = (s: string): number | null => {
  if (s.trim() === "") return null;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
};

export default function SbiPage() {
  const { db, user } = useStore();
  const me = user?.playerId ? db.players.find(p => p.id === user.playerId) : null;
  const snap = me ? latest(me) : null;

  const [grade, setGrade] = useState(me ? String(Math.min(3, Math.max(1, me.grade))) : "3");
  const [height, setHeight] = useState(snap ? String(snap.body.height) : "175");
  const [weight, setWeight] = useState(snap ? String(snap.body.weight) : "65");
  const [velo, setVelo] = useState(snap ? String(snap.practical.maxVelo) : "132");
  const [sprint, setSprint] = useState("1.55");
  const [vertical, setVertical] = useState("58");
  const [squat, setSquat] = useState("50");
  const [dead, setDead] = useState("13");
  const [push, setPush] = useState("16");

  // SMI 입력 (Method 2)
  const [landDist, setLandDist] = useState("480"); // 착지거리 cm
  const [upperOnly, setUpperOnly] = useState("8.5"); // 하체고정 상체만 (m)
  const [fullBody, setFullBody] = useState("11"); // 전신 투구폼 (m)
  const [elbowThrow, setElbowThrow] = useState("7.2"); // 무릎 꿇고 메디신볼 (m)
  const [detail, setDetail] = useState<"sbi" | "smi" | null>(null);

  const result = useMemo(() => {
    const h = parse(height), w = parse(weight);
    const nVelo = parse(velo), nSprint = parse(sprint), nVert = parse(vertical);
    const nSquat = parse(squat), nDead = parse(dead), nPush = parse(push);
    const nLand = parse(landDist), nUpper = parse(upperOnly), nFull = parse(fullBody), nElbow = parse(elbowThrow);

    const sSquat = nSquat === null ? null : clamp100(scoreSquat(nSquat));
    const sDead = nDead === null ? null : clamp100(scoreDead(nDead));
    const sPush = nPush === null ? null : clamp100(scorePush(nPush));
    const avg = sSquat !== null && sDead !== null && sPush !== null ? (sSquat + sDead + sPush) / 3 : null;

    let sbiRaw: number | null = null;
    if (avg !== null && nVert !== null && nVelo !== null && nSprint !== null && nSprint > 0) {
      sbiRaw = ((avg + nVert + nVelo) / (nSprint * 10)) * C_U15;
    }
    const sbi = sbiRaw === null ? null : clamp100(sbiRaw);

    // SMI
    const brakePct = h !== null && h > 0 && nLand !== null ? (nLand / h) * 100 : null;
    const accelPct = nUpper !== null && nUpper > 0 && nFull !== null ? (nFull / nUpper) * 100 : null;
    const sBrake = brakePct === null ? null : clamp100(scoreBrake(brakePct));
    const sAccel = accelPct === null ? null : clamp100(scoreAccel(accelPct));
    const sElbow = nElbow === null ? null : clamp100(scoreElbowM2(nElbow));
    const smi =
      sBrake !== null && sAccel !== null && sElbow !== null
        ? clamp100((sBrake + sAccel + sElbow) / 3)
        : null;

    const finalR =
      sbi !== null && smi !== null ? clamp100(sbi / 2 + smi / 2) : null;

    const normVert = nVert === null ? null : clamp100((nVert / NORM.vertMax) * 100);
    const normVelo = nVelo === null ? null : clamp100((nVelo / NORM.veloMax) * 100);
    const normSprint =
      nSprint === null ? null : clamp100(((NORM.sprintWorst - nSprint) / (NORM.sprintWorst - NORM.sprintBest)) * 100);

    const warn =
      nVelo !== null &&
      nSprint !== null &&
      avg !== null &&
      avg >= 70 &&
      (smi === null || smi >= 70) &&
      normVelo !== null &&
      normVelo < 50;

    return {
      h, w, nVelo, nSprint, nVert, nSquat, nDead, nPush,
      sSquat, sDead, sPush, avg, sbi, sbiRaw,
      nLand, nUpper, nFull, nElbow, brakePct, accelPct,
      sBrake, sAccel, sElbow, smi, finalR,
      normVert, normVelo, normSprint, warn,
    };
  }, [height, weight, velo, sprint, vertical, squat, dead, push, landDist, upperOnly, fullBody, elbowThrow]);

  const load = LOADS[grade];
  const loadHint = (kind: "squat" | "dead" | "push") => {
    if (kind === "push") return load.push === 0 ? "순수 맨몸" : `가중 ${load.push}kg (고정)`;
    if (result.w === null || result.w <= 0) return "체중 입력 시 덤벨 무게 표시";
    if (kind === "squat") return `덤벨 ${Math.round(result.w * load.squat)}kg`;
    return `양손 총 ${Math.round(result.w * load.dead)}kg (한 손당 ${Math.round((result.w * load.dead) / 2)}kg)`;
  };

  const tiles = [
    { key: "sbi" as const, label: "SBI", value: result.sbi },
    { key: "smi" as const, label: "SMI", value: result.smi },
  ];

  return (
    <>
      <PageHead
        title="SBI / SMI 계산기"
        desc="U15 중학교 기준 — SBI(버퍼 인덱스)와 SMI(역학 인덱스, 팔꿈치 폄 속도 Method 2)를 함께 산출합니다. 최종 점수 R = SBI/2 + SMI/2"
      />

      {/* ---------- 결과 히어로 — 주인공은 최종 R 링 ---------- */}
      <div className="panel hero">
        <div className="flex gap24 wrap start sbi-hero-row">
          {result.finalR === null ? (
            <div>
              <div className="eyebrow">최종 R</div>
              <div className="display md faint">–</div>
            </div>
          ) : (
            <ScoreRing value={result.finalR} size={148} stroke={11} label="최종 R" display={r1(result.finalR)} />
          )}

          <div className="grow">
            <div className="tile-row">
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
                    <span className="t-value">{item.value === null ? "-" : r1(item.value)}</span>
                    <span className="t-sub">{on ? "닫기" : "종목 그래프"}</span>
                  </button>
                );
              })}
            </div>
            <div className="faint xs mt12">
              U15 · C = 5.1 · 팔꿈치 폄 Method 2 · SBI/SMI 탭하여 구성 종목 확인
            </div>
            <div className="faint xs mono mt4">R = SBI/2 + SMI/2</div>
          </div>
        </div>

        {result.warn && (
          <Notice kind="warn" className="mt16">
            <b>구속 버퍼 경고</b> — 스트렝스/역학 점수는 우수하나 구속이 부족합니다. 체중 부족 또는 순발력(파워 전환) 부족을 점검해보세요.
          </Notice>
        )}
      </div>

      {/* ---------- 구성 종목 / 종목 프로필 ---------- */}
      {detail === "sbi" && (
        <div className="panel">
          <div className="eyebrow mb8">SBI 구성 종목</div>
          <ScoreBar label="스쿼트" score={Math.round(result.sSquat ?? 0)} comment={result.nSquat !== null ? `${result.nSquat}개` : undefined} />
          <ScoreBar label="외발 데드리프트" score={Math.round(result.sDead ?? 0)} comment={result.nDead !== null ? `${result.nDead}회` : undefined} />
          <ScoreBar label="푸쉬업" score={Math.round(result.sPush ?? 0)} comment={result.nPush !== null ? `${result.nPush}개` : undefined} />
          <ScoreBar label="3대 스트렝스 평균" score={Math.round(result.avg ?? 0)} />
          <ScoreBar label="버티컬 (정규화)" score={Math.round(result.normVert ?? 0)} comment={result.nVert !== null ? `${result.nVert}cm` : undefined} />
          <ScoreBar label="최고 구속 (정규화)" score={Math.round(result.normVelo ?? 0)} comment={result.nVelo !== null ? `${result.nVelo}km/h` : undefined} />
          <ScoreBar label="스프린트 (정규화)" score={Math.round(result.normSprint ?? 0)} comment={result.nSprint !== null ? `${result.nSprint}초` : undefined} />
        </div>
      )}

      {detail === "smi" && (
        <div className="panel">
          <div className="eyebrow mb8">SMI 구성 종목</div>
          <ScoreBar
            label="제동력"
            score={Math.round(result.sBrake ?? 0)}
            comment={result.brakePct !== null ? `신장대비 ${r1(result.brakePct)}%` : undefined}
          />
          <ScoreBar
            label="가속효율"
            score={Math.round(result.sAccel ?? 0)}
            comment={result.accelPct !== null ? `비대칭 ${r1(result.accelPct)}%` : undefined}
          />
          <ScoreBar
            label="팔꿈치 폄 (M2)"
            score={Math.round(result.sElbow ?? 0)}
            comment={result.nElbow !== null ? `${result.nElbow}m` : undefined}
          />
        </div>
      )}

      {detail === null && (
        <div className="panel">
          <div className="card-head">
            <h3>SBI 종목 프로필</h3>
            <span className="meta">정규화 점수 0–100 (측정값)</span>
          </div>
          <div className="split even">
            <div>
              <Radar values={[result.sSquat, result.sDead, result.sPush, result.normVert, result.normVelo, result.normSprint]} />
            </div>
            <div className="kv">
              <KvScore k="스쿼트" score={result.sSquat} raw={result.nSquat !== null ? `${result.nSquat}개` : undefined} />
              <KvScore k="외발 데드리프트" score={result.sDead} raw={result.nDead !== null ? `${result.nDead}회` : undefined} />
              <KvScore k="푸쉬업" score={result.sPush} raw={result.nPush !== null ? `${result.nPush}개` : undefined} />
              <KvScore k="버티컬" score={result.normVert} raw={result.nVert !== null ? `${result.nVert}cm` : undefined} />
              <KvScore k="최고 구속" score={result.normVelo} raw={result.nVelo !== null ? `${result.nVelo}km/h` : undefined} />
              <KvScore k="10m 스프린트" score={result.normSprint} raw={result.nSprint !== null ? `${result.nSprint}초` : undefined} />
            </div>
          </div>
        </div>
      )}

      {/* ---------- 측정 입력 ---------- */}
      <Section title="측정 입력" meta="값을 바꾸면 위 결과가 바로 갱신됩니다">
        <div className="panel">
          <div className="columns n3">
            <div className="col">
              <div className="col-head">
                <h4>기본 정보</h4>
                <span className="faint xs">U15 · 신체 · 구속 · 점프</span>
              </div>
              <div className="form-grid cols-2">
                <div className="field">
                  <label>학년</label>
                  <select value={grade} onChange={e => setGrade(e.target.value)}>
                    <option value="1">중1 (만 13세)</option>
                    <option value="2">중2 (만 14세)</option>
                    <option value="3">중3 (만 15세)</option>
                  </select>
                </div>
                <div className="field">
                  <label>신장 (cm)</label>
                  <input type="number" step={0.1} value={height} onChange={e => setHeight(e.target.value)} />
                </div>
                <div className="field">
                  <label>체중 (kg)</label>
                  <input type="number" step={0.1} value={weight} onChange={e => setWeight(e.target.value)} />
                </div>
                <div className="field">
                  <label>최고 구속 (km/h)</label>
                  <input type="number" step={1} value={velo} onChange={e => setVelo(e.target.value)} />
                </div>
                <div className="field">
                  <label>10m 스프린트 (초)</label>
                  <input type="number" step={0.01} value={sprint} onChange={e => setSprint(e.target.value)} />
                </div>
                <div className="field">
                  <label>버티컬 점프 (cm)</label>
                  <input type="number" step={1} value={vertical} onChange={e => setVertical(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="col">
              <div className="col-head">
                <h4>SBI — 3대 스트렝스</h4>
                <span className="faint xs">덤벨 가중 반복</span>
              </div>
              <div className="form-grid cols-1">
                <div className="field">
                  <label>스쿼트 (개수)</label>
                  <input type="number" step={1} value={squat} onChange={e => setSquat(e.target.value)} />
                  <span className="help warn">{loadHint("squat")}</span>
                </div>
                <div className="field">
                  <label>외발 데드리프트 (횟수)</label>
                  <input type="number" step={1} value={dead} onChange={e => setDead(e.target.value)} />
                  <span className="help warn">{loadHint("dead")}</span>
                </div>
                <div className="field">
                  <label>푸쉬업 (개수)</label>
                  <input type="number" step={1} value={push} onChange={e => setPush(e.target.value)} />
                  <span className="help warn">{loadHint("push")}</span>
                </div>
              </div>
              <div className="faint xs mt12">* 반올림한 무게의 덤벨 사용</div>
            </div>

            <div className="col">
              <div className="col-head">
                <h4>SMI — 역학 검사</h4>
                <span className="faint xs">제동 · 가속 · 팔꿈치 M2</span>
              </div>
              <div className="form-grid cols-1">
                <div className="field">
                  <label>제동력 — 3연속 점프 착지거리 (cm)</label>
                  <input type="number" step={1} value={landDist} onChange={e => setLandDist(e.target.value)} />
                  <span className="help">
                    투구 디딤발로 최대 3연속 점프, 마지막 착지 2초 버티기
                    {result.brakePct !== null && ` · 신장대비 ${r1(result.brakePct)}%`}
                  </span>
                </div>
                <div className="field">
                  <label>가속효율 — 하체 고정·상체만 던지기 (m)</label>
                  <input type="number" step={0.1} value={upperOnly} onChange={e => setUpperOnly(e.target.value)} />
                  <span className="help">2~3kg 메디신볼</span>
                </div>
                <div className="field">
                  <label>가속효율 — 전신 투구폼 던지기 (m)</label>
                  <input type="number" step={0.1} value={fullBody} onChange={e => setFullBody(e.target.value)} />
                  {result.accelPct !== null && (
                    <span className="help">비대칭비율 {r1(result.accelPct)}%</span>
                  )}
                </div>
                <div className="field">
                  <label>팔꿈치 폄 속도 Method 2 — 무릎 꿇고 메디신볼 비거리 (m)</label>
                  <input type="number" step={0.1} value={elbowThrow} onChange={e => setElbowThrow(e.target.value)} />
                  <span className="help">1~2kg 메디신볼, 투구하듯 팔꿈치를 펴며 던지기</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ---------- 세부 점수 ---------- */}
      <Section title="세부 점수">
        <div className="split even">
          <div>
            <div className="panel">
              <div className="card-head">
                <h3>SBI 세부</h3>
                <span className="meta">환산 점수 (측정값)</span>
              </div>
              <div className="kv">
                <div className="kv-row">
                  <span className="k">스쿼트</span>
                  <span className="v">{result.sSquat === null ? "-" : `${r1(result.sSquat)} (${result.nSquat}개)`}</span>
                </div>
                <div className="kv-row">
                  <span className="k">외발 데드리프트</span>
                  <span className="v">{result.sDead === null ? "-" : `${r1(result.sDead)} (${result.nDead}회)`}</span>
                </div>
                <div className="kv-row">
                  <span className="k">푸쉬업</span>
                  <span className="v">{result.sPush === null ? "-" : `${r1(result.sPush)} (${result.nPush}개)`}</span>
                </div>
                <div className="kv-row">
                  <span className="k">3대 스트렝스 평균</span>
                  <span className="v">{result.avg === null ? "-" : r1(result.avg)}</span>
                </div>
                <div className="kv-row">
                  <span className="k">버티컬 / 구속 / 스프린트</span>
                  <span className="v">{result.nVert ?? "-"} / {result.nVelo ?? "-"} / {result.nSprint ?? "-"}</span>
                </div>
                <div className="kv-row total">
                  <span className="k">SBI</span>
                  <span className="v">{result.sbi === null ? "-" : r1(result.sbi)}</span>
                </div>
              </div>
              {result.sbiRaw !== null && result.avg !== null && (
                <div className="formula">
                  SBI = ({r1(result.avg)}+{result.nVert}+{result.nVelo})÷({result.nSprint}×10)×{C_U15} = <b>{r1(result.sbiRaw)}</b>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="panel">
              <div className="card-head">
                <h3>SMI 세부</h3>
                <span className="meta">환산 점수 (측정값)</span>
              </div>
              <div className="kv">
                <div className="kv-row">
                  <span className="k">제동력</span>
                  <span className="v">
                    {result.sBrake === null
                      ? "-"
                      : `${r1(result.sBrake)} (${r1(result.brakePct!)}%)`}
                  </span>
                </div>
                <div className="kv-row">
                  <span className="k">가속효율</span>
                  <span className="v">
                    {result.sAccel === null
                      ? "-"
                      : `${r1(result.sAccel)} (${r1(result.accelPct!)}%)`}
                  </span>
                </div>
                <div className="kv-row">
                  <span className="k">팔꿈치 폄 (M2)</span>
                  <span className="v">{result.sElbow === null ? "-" : `${r1(result.sElbow)} (${result.nElbow}m)`}</span>
                </div>
                <div className="kv-row total">
                  <span className="k">SMI</span>
                  <span className="v">{result.smi === null ? "-" : r1(result.smi)}</span>
                </div>
                <div className="kv-row total">
                  <span className="k">최종 R</span>
                  <span className="v">{result.finalR === null ? "-" : r1(result.finalR)}</span>
                </div>
              </div>
              {result.smi !== null && result.sbi !== null && (
                <div className="formula">
                  SMI = ({r1(result.sBrake!)}+{r1(result.sAccel!)}+{r1(result.sElbow!)})÷3 = <b>{r1(result.smi)}</b>
                  <br />
                  R = {r1(result.sbi)}/2 + {r1(result.smi)}/2 = <b>{r1(result.finalR!)}</b>
                </div>
              )}
              <details className="sbi-formula-details mt12">
                <summary>SMI 환산 공식 보기</summary>
                <div className="small faint">
                  <b>제동력</b> (착지거리÷신장×100): ≥300→100 | 290~300→70+(%−290)×3 | 240~290→40+(%−240)×0.6 | &lt;240→%×(40/240)<br />
                  <b>가속효율</b> (전신÷상체만×100): ≥140→100 | 139~140→70+(%−139)×30 | 115~139→40+(%−115)×(30/24) | &lt;115→%×(40/115)<br />
                  <b>팔꿈치 폄 Method 2</b> (m): ≥8.5→100 | 8~8.5→70+(m−8)×60 | 6~8→40+(m−6)×15 | &lt;6→m×(40/6)
                </div>
              </details>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
