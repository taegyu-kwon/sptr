import type { BodyData, AthleticData, PracticalData, Snapshot, Player } from "./types";

export type Grade = "S" | "A" | "B" | "C" | "D";

export interface CategoryResult {
  score: number; // 0-100
  grade: Grade;
  breakdown: { label: string; score: number; comment: string }[];
}

export interface GpeResult {
  total: number;
  totalGrade: Grade;
  body: CategoryResult;
  athletic: CategoryResult;
  practical: CategoryResult;
  trainingPriorities: { area: string; reason: string; priority: number }[];
  growthFeedback: string[];
  injuryRisk: { level: "낮음" | "보통" | "높음"; score: number; factors: string[] };
}

export function toGrade(score: number): Grade {
  if (score >= 90) return "S";
  if (score >= 78) return "A";
  if (score >= 64) return "B";
  if (score >= 50) return "C";
  return "D";
}

export const gradeColor: Record<Grade, string> = {
  S: "#a371f7",
  A: "#2f81f7",
  B: "#3fb950",
  C: "#d29922",
  D: "#f85149",
};

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** 값을 [worst, best] 구간에 대해 0~100으로 정규화. best < worst면 낮을수록 좋음 */
function norm(value: number, worst: number, best: number): number {
  if (best === worst) return 50;
  return clamp(((value - worst) / (best - worst)) * 100);
}

// ---------- 신체 점수 ----------
export function scoreBody(b: BodyData): CategoryResult {
  const items = [
    {
      label: "체격 (키/몸무게)",
      score: norm(b.height, 150, 190) * 0.6 + norm(b.weight, 40, 95) * 0.4,
      comment: b.height >= 175 ? "동나이대 대비 우수한 체격" : "성장 여지가 남아 있는 체격",
    },
    {
      label: "근골격 구성 (인바디)",
      score: norm(b.skeletalMuscle, 20, 42) * 0.7 + norm(b.bodyFat, 28, 10) * 0.3,
      comment: b.skeletalMuscle >= 32 ? "골격근량이 충분함" : "골격근량 증가가 필요함",
    },
    {
      label: "프레임 (윙스팬/다리)",
      score:
        norm(b.wingspan - b.height, -4, 10) * 0.6 +
        norm(b.legLength / Math.max(b.height, 1), 0.42, 0.5) * 0.4,
      comment: b.wingspan - b.height >= 4 ? "윙스팬 우위 — 투구/타구 확장성 좋음" : "평균적인 프레임",
    },
    {
      label: "성장 모멘텀 (1년 변화)",
      score: norm(b.heightChange1y, 0, 10) * 0.7 + norm(b.weightChange1y, 0, 9) * 0.3,
      comment: b.heightChange1y >= 5 ? "성장판 활발 — 급성장 구간" : "성장 속도 완만",
    },
    {
      label: "관절 가동범위",
      score: clamp(b.jointROM),
      comment: b.jointROM >= 75 ? "관절 가동범위 우수" : "모빌리티 보강 필요",
    },
  ];
  const injuryPenalty = b.injuryHistory.trim()
    ? Math.min(10, b.injuryHistory.split(",").filter(s => s.trim()).length * 4)
    : 0;
  const score = clamp(items.reduce((s, i) => s + i.score, 0) / items.length - injuryPenalty);
  return {
    score: Math.round(score),
    grade: toGrade(score),
    breakdown: items.map(i => ({ ...i, score: Math.round(i.score) })),
  };
}

// ---------- 운동능력 점수 ----------
export function scoreAthletic(a: AthleticData, weightKg: number): CategoryResult {
  const rel = (lift: number) => lift / Math.max(weightKg, 1); // 체중 대비 중량
  const items = [
    {
      label: "상체 근력 (가슴/어깨/등)",
      score:
        norm(rel(a.benchPress), 0.4, 1.2) * 0.4 +
        norm(rel(a.shoulderPress), 0.25, 0.8) * 0.3 +
        norm(rel(a.rowPull), 0.4, 1.1) * 0.3,
      comment: rel(a.benchPress) >= 0.9 ? "상체 출력 우수" : "상체 근력 보강 여지",
    },
    {
      label: "하체 근력 (밀기/당기기)",
      score: norm(rel(a.squat), 0.6, 1.8) * 0.55 + norm(rel(a.deadlift), 0.7, 2.0) * 0.45,
      comment: rel(a.squat) >= 1.4 ? "하체 출력 우수 — 구속/타구속도의 기반" : "하체 근력이 핵심 보강 포인트",
    },
    {
      label: "스피드 (60/30yd 대시)",
      score: norm(a.dash60, 9.2, 6.6) * 0.6 + norm(a.dash30, 5.0, 3.6) * 0.4,
      comment: a.dash60 <= 7.2 ? "주루/수비 범위에 강점" : "가속 훈련 필요",
    },
    {
      label: "지구력 (5km 페이스)",
      score: norm(a.run5kPace, 7.5, 4.0),
      comment: a.run5kPace <= 5.0 ? "심폐 지구력 우수" : "유산소 베이스 보강 필요",
    },
    {
      label: "코어 (플랭크 max)",
      score: norm(a.plankMax, 40, 240),
      comment: a.plankMax >= 150 ? "코어 안정성 우수" : "코어 강화 필요 — 부상 예방에 직결",
    },
  ];
  const score = clamp(items.reduce((s, i) => s + i.score, 0) / items.length);
  return {
    score: Math.round(score),
    grade: toGrade(score),
    breakdown: items.map(i => ({ ...i, score: Math.round(i.score) })),
  };
}

// ---------- 실전 점수 ----------
export function scorePractical(p: PracticalData): CategoryResult {
  const isPitcher = p.kind === "투수";
  const items = isPitcher
    ? [
        { label: "최고 구속", score: norm(p.maxVelo, 105, 145), comment: p.maxVelo >= 135 ? "또래 상위권 구속" : "구속 상승 여지 있음", w: 0.4 },
        { label: "커맨드", score: clamp(p.command), comment: p.command >= 70 ? "존 공략 능력 안정적" : "제구 일관성 훈련 필요", w: 0.35 },
        { label: "멀리 던지기", score: norm(p.longThrow, 55, 100), comment: "어깨 출력 지표", w: 0.15 },
        { label: "수비 안정성 (PFP)", score: norm(p.errorRate, 25, 2), comment: p.errorRate <= 8 ? "수비 안정성 우수" : "PFP 반복 훈련 필요", w: 0.1 },
      ]
    : [
        { label: "송구 (멀리 던지기)", score: norm(p.longThrow, 55, 100), comment: p.longThrow >= 85 ? "강한 어깨" : "송구 거리 보강 여지", w: 0.3 },
        { label: "송구 속도", score: norm(p.maxVelo, 95, 135), comment: "송구 속도 지표", w: 0.2 },
        { label: "송구 정확도", score: clamp(p.command), comment: p.command >= 70 ? "정확한 송구" : "송구 정확도 훈련 필요", w: 0.2 },
        { label: "에러율 (펑고)", score: norm(p.errorRate, 25, 2), comment: p.errorRate <= 8 ? "수비 안정성 우수" : "포구 기본기 반복 필요", w: 0.3 },
      ];
  const totalW = items.reduce((s, i) => s + i.w, 0);
  const score = clamp(items.reduce((s, i) => s + i.score * i.w, 0) / totalW);
  return {
    score: Math.round(score),
    grade: toGrade(score),
    breakdown: items.map(({ w, ...i }) => ({ ...i, score: Math.round(i.score) })),
  };
}

// ---------- 부상 리스크 ----------
export function assessRisk(b: BodyData, a: AthleticData, p: PracticalData) {
  const factors: string[] = [];
  let risk = 15;

  const outputVsFrame =
    scorePractical(p).score - (scoreBody(b).score + scoreAthletic(a, b.weight).score) / 2;
  if (outputVsFrame > 18) {
    risk += 30;
    factors.push("신체·운동능력 대비 출력이 과도함 — 밸런스 불균형");
  } else if (outputVsFrame > 8) {
    risk += 15;
    factors.push("출력이 신체 발달 속도보다 다소 앞서 있음");
  }
  if (b.jointROM < 60) {
    risk += 18;
    factors.push("관절 가동범위 부족 — 스로잉 시 팔 부담 증가");
  }
  if (a.plankMax < 90) {
    risk += 12;
    factors.push("코어 안정성 부족 — 체간 회전 시 부상 위험");
  }
  const injuries = b.injuryHistory.split(",").map(s => s.trim()).filter(Boolean);
  if (injuries.length > 0) {
    risk += injuries.length * 8;
    factors.push(`부상/통증 이력 ${injuries.length}건 (${injuries.join(", ")})`);
  }
  if (p.kind === "투수" && p.maxVelo >= 135 && b.skeletalMuscle < 30) {
    risk += 12;
    factors.push("구속 대비 골격근량 부족 — 팔꿈치/어깨 부담 주의");
  }
  if (b.heightChange1y >= 7) {
    risk += 8;
    factors.push("급성장기 — 성장판 및 힘줄 부하 관리 필요");
  }
  if (factors.length === 0) factors.push("특이 위험 요인 없음");

  risk = clamp(risk);
  const level = risk >= 60 ? "높음" : risk >= 35 ? "보통" : "낮음";
  return { level: level as "낮음" | "보통" | "높음", score: Math.round(risk), factors };
}

// ---------- 종합 평가 ----------
export function evaluate(s: Snapshot): GpeResult {
  const body = scoreBody(s.body);
  const athletic = scoreAthletic(s.athletic, s.body.weight);
  const practical = scorePractical(s.practical);
  const total = Math.round(body.score * 0.35 + athletic.score * 0.3 + practical.score * 0.35);

  const cats = [
    { key: "신체", res: body },
    { key: "운동능력", res: athletic },
    { key: "실전", res: practical },
  ].sort((x, y) => x.res.score - y.res.score);

  const trainingPriorities = cats.map((c, i) => {
    const weakest = [...c.res.breakdown].sort((a2, b2) => a2.score - b2.score)[0];
    return { area: `${c.key} — ${weakest.label}`, reason: weakest.comment, priority: i + 1 };
  });

  const growthFeedback: string[] = [];
  if (s.practical.kind === "투수") {
    if (body.score >= 65) {
      growthFeedback.push(
        "신체 평가 기준 고교 진학 후 구속 상승의 여지가 큽니다. 이를 극대화하려면 성장 주기에 맞는 웨이트 트레이닝과 식단 조절, 가속도 훈련 보충이 필요합니다."
      );
    } else {
      growthFeedback.push(
        "현재는 체격 기반이 약해 구속보다 커맨드와 투구폼 효율을 우선 다지는 것이 장기적으로 유리합니다."
      );
    }
    const cmd = practical.breakdown.find(b2 => b2.label === "커맨드");
    if (cmd && cmd.score < 60) {
      growthFeedback.push("커맨드 지표가 낮아, 불펜 세션에서 존 4분할 타겟 훈련 비중을 높이는 것을 권장합니다.");
    }
  } else {
    const spd = athletic.breakdown.find(b2 => b2.label.includes("스피드"));
    if (spd && spd.score >= 70) {
      growthFeedback.push("스피드 툴이 상위권입니다. 주루·수비 범위를 무기로 리드오프/센터라인 자원으로 성장 가능성이 높습니다.");
    }
    const err = practical.breakdown.find(b2 => b2.label.includes("에러율"));
    if (err && err.score < 60) {
      growthFeedback.push("수비 안정성이 과제입니다. 펑고 반복량을 늘리고 포구 기본기(글러브 각도, 스텝)를 교정해야 합니다.");
    }
    growthFeedback.push(
      body.score >= 65
        ? "체격 성장 여지가 충분해 고교 진학 후 장타 툴 발현이 기대됩니다."
        : "체격 성장 모멘텀이 완만해, 기술 완성도와 컨택 능력 중심의 성장 전략이 적합합니다."
    );
  }
  if (athletic.score < 60) {
    growthFeedback.push("운동능력 기초(근력/지구력)가 실전 능력 대비 낮습니다. 시즌 외 기간 피지컬 블록 훈련을 우선 배치하세요.");
  }

  const injuryRisk = assessRisk(s.body, s.athletic, s.practical);

  return { total, totalGrade: toGrade(total), body, athletic, practical, trainingPriorities, growthFeedback, injuryRisk };
}

export function latest(p: Player): Snapshot {
  return p.records[p.records.length - 1];
}

export function evaluatePlayer(p: Player): GpeResult {
  return evaluate(latest(p));
}
