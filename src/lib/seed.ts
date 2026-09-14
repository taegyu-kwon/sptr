import type { DB, Player, Snapshot, PlayerKind, Position } from "./types";

// 시드 고정 난수 — 데모 데이터가 항상 동일하게 생성됨
let seedVal = 42;
function rnd() {
  seedVal = (seedVal * 16807) % 2147483647;
  return (seedVal - 1) / 2147483646;
}
const between = (lo: number, hi: number, digits = 1) =>
  Math.round((lo + rnd() * (hi - lo)) * 10 ** digits) / 10 ** digits;

function makeSnapshots(base: {
  age: number;
  height: number;
  weight: number;
  kind: PlayerKind;
  talent: number; // 0~1
}): Snapshot[] {
  const n = 5; // 최근 5회 측정 (분기별)
  const snaps: Snapshot[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const height = base.height + t * (3 + base.talent * 5);
    const weight = base.weight + t * (3 + base.talent * 6);
    const date = new Date(2025, 6 + i * 3, 10).toISOString().slice(0, 10);
    snaps.push({
      date,
      body: {
        age: base.age,
        height: Math.round(height * 10) / 10,
        weight: Math.round(weight * 10) / 10,
        skeletalMuscle: between(22 + base.talent * 8 + t * 3, 24 + base.talent * 9 + t * 3),
        bodyFat: between(18 - t * 2 - base.talent * 3, 21 - t * 2 - base.talent * 3),
        wingspan: Math.round((height + between(-2, 8)) * 10) / 10,
        legLength: Math.round(height * between(0.44, 0.48, 3) * 10) / 10,
        heightChange1y: between(2 + base.talent * 5, 4 + base.talent * 6),
        weightChange1y: between(2, 6),
        jointROM: Math.round(between(55 + base.talent * 25, 65 + base.talent * 30)),
        injuryHistory: rnd() < 0.25 ? "팔꿈치 통증" : "",
      },
      athletic: {
        benchPress: Math.round(weight * between(0.5 + base.talent * 0.35 + t * 0.15, 0.6 + base.talent * 0.4 + t * 0.15)),
        shoulderPress: Math.round(weight * between(0.3 + base.talent * 0.2, 0.4 + base.talent * 0.25)),
        rowPull: Math.round(weight * between(0.5 + base.talent * 0.3, 0.6 + base.talent * 0.35)),
        squat: Math.round(weight * between(0.9 + base.talent * 0.5 + t * 0.2, 1.1 + base.talent * 0.5 + t * 0.2)),
        deadlift: Math.round(weight * between(1.0 + base.talent * 0.6 + t * 0.2, 1.2 + base.talent * 0.6 + t * 0.2)),
        dash60: between(8.6 - base.talent * 1.6 - t * 0.3, 9.0 - base.talent * 1.6 - t * 0.3, 2),
        dash30: between(4.7 - base.talent * 0.8 - t * 0.15, 4.9 - base.talent * 0.8 - t * 0.15, 2),
        run5kPace: between(6.6 - base.talent * 1.8 - t * 0.3, 7.0 - base.talent * 1.8 - t * 0.3, 2),
        plankMax: Math.round(between(70 + base.talent * 100 + t * 40, 90 + base.talent * 110 + t * 40)),
      },
      practical: {
        kind: base.kind,
        maxVelo: Math.round(
          base.kind === "투수"
            ? between(112 + base.talent * 22 + t * 6, 118 + base.talent * 24 + t * 6)
            : between(102 + base.talent * 20 + t * 5, 108 + base.talent * 22 + t * 5)
        ),
        longThrow: Math.round(between(58 + base.talent * 30 + t * 8, 65 + base.talent * 32 + t * 8)),
        command: Math.round(between(45 + base.talent * 35 + t * 10, 55 + base.talent * 38 + t * 10)),
        errorRate: between(16 - base.talent * 11 - t * 3, 20 - base.talent * 12 - t * 3, 1),
      },
    });
  }
  return snaps;
}

const rosterSpec: { name: string; position: Position; kind: PlayerKind; grade: number; talent: number }[] = [
  { name: "김하준", position: "투수", kind: "투수", grade: 3, talent: 0.9 },
  { name: "이서진", position: "투수", kind: "투수", grade: 2, talent: 0.65 },
  { name: "박도윤", position: "투수", kind: "투수", grade: 3, talent: 0.5 },
  { name: "최시우", position: "포수", kind: "야수", grade: 3, talent: 0.7 },
  { name: "정예준", position: "포수", kind: "야수", grade: 1, talent: 0.45 },
  { name: "강민재", position: "내야수", kind: "야수", grade: 3, talent: 0.85 },
  { name: "조은호", position: "내야수", kind: "야수", grade: 2, talent: 0.6 },
  { name: "윤지호", position: "내야수", kind: "야수", grade: 2, talent: 0.55 },
  { name: "임태양", position: "내야수", kind: "야수", grade: 1, talent: 0.4 },
  { name: "한결", position: "외야수", kind: "야수", grade: 3, talent: 0.75 },
  { name: "서준우", position: "외야수", kind: "야수", grade: 2, talent: 0.5 },
  { name: "문성민", position: "외야수", kind: "야수", grade: 1, talent: 0.35 },
];

export function buildSeed(): DB {
  seedVal = 42;
  const teamId = "t-seongnam";
  const teams = [{ id: teamId, name: "성남중학교 야구부", region: "경기 성남" }];

  const players: Player[] = rosterSpec.map((spec, i) => {
    const records = makeSnapshots({
      age: 12 + spec.grade,
      height: between(158, 176) + spec.talent * 4,
      weight: between(48, 68) + spec.talent * 6,
      kind: spec.kind,
      talent: spec.talent,
    });
    const t = spec.talent;
    return {
      id: `p${i + 1}`,
      name: spec.name,
      teamId,
      position: spec.position,
      backNumber: i + 1,
      grade: spec.grade,
      records,
      sbiMetrics: {
        sprint: Math.round((1.72 - t * 0.22) * 100) / 100,
        vertical: Math.round(42 + t * 22),
        squatReps: Math.round(28 + t * 24),
        deadReps: Math.round(6 + t * 8),
        pushReps: Math.round(14 + t * 22),
        landDist: Math.round(400 + t * 120),
        upperOnly: Math.round((7.2 + t * 1.8) * 10) / 10,
        fullBody: Math.round((9.0 + t * 3.2) * 10) / 10,
        elbowThrow: Math.round((5.5 + t * 3.2) * 10) / 10,
      },
    };
  });

  const starPlayer = players[0]; // 김하준

  const users = [
    { id: "u-player", email: "player@sptr.demo", password: "demo1234", name: starPlayer.name, role: "player" as const, teamId, playerId: starPlayer.id },
    { id: "u-coach", email: "coach@sptr.demo", password: "demo1234", name: "박정후 감독", role: "coach" as const, teamId, playerId: null },
  ];

  const feedbacks = [
    { id: "f1", teamId, playerId: "p1", author: "박정후 감독", date: "2026-07-05", category: "투구", content: "릴리스 포인트가 안정되면서 구속이 올라오고 있다. 다만 경기 후반 밸런스가 무너지는 경향이 있으니 하체 지구력 훈련을 병행할 것." },
    { id: "f2", teamId, playerId: "p1", author: "이코치", date: "2026-06-20", category: "컨디셔닝", content: "급성장기라 햄스트링 유연성이 떨어져 있음. 매 훈련 전후 스트레칭 루틴 필수." },
    { id: "f3", teamId, playerId: "p6", author: "박정후 감독", date: "2026-07-02", category: "타격", content: "히팅 포인트를 앞에 두는 연습이 효과를 보고 있다. 변화구 대응 훈련 추가." },
    { id: "f4", teamId, playerId: null, author: "박정후 감독", date: "2026-07-08", category: "팀 전체", content: "하계 대회 대비 기간입니다. 수비 조직력(중계 플레이, 커버링)을 집중 점검합니다. 전원 훈련 30분 전 도착해서 개인 스트레칭 완료할 것." },
    { id: "f5", teamId, playerId: null, author: "이코치", date: "2026-06-25", category: "팀 전체", content: "최근 측정에서 팀 평균 코어 지표가 향상됐습니다. 다음 블록은 스피드 훈련 비중을 높입니다." },
  ];

  const training = [
    { id: "tr1", teamId, day: "월", position: "전체" as const, time: "16:00-18:00", content: "팀 웜업 + 기초 체력 (러닝, 코어)" },
    { id: "tr2", teamId, day: "화", position: "투수" as const, time: "16:00-18:30", content: "불펜 세션 (존 4분할 타겟) + 하체 웨이트" },
    { id: "tr3", teamId, day: "화", position: "내야수" as const, time: "16:00-18:30", content: "펑고 100구 + 더블플레이 연계" },
    { id: "tr4", teamId, day: "수", position: "포수" as const, time: "16:00-18:00", content: "블로킹/프레이밍 + 2루 송구 타임 측정" },
    { id: "tr5", teamId, day: "수", position: "외야수" as const, time: "16:00-18:00", content: "타구 판단 + 중계 플레이" },
    { id: "tr6", teamId, day: "목", position: "전체" as const, time: "16:00-19:00", content: "팀 배팅 + 상황별 주루" },
    { id: "tr7", teamId, day: "금", position: "투수" as const, time: "16:00-18:00", content: "롱토스 + 가속도 훈련 (플라이오)" },
    { id: "tr8", teamId, day: "토", position: "전체" as const, time: "10:00-13:00", content: "자체 청백전 / 연습경기" },
  ];

  const games = [
    {
      id: "g1", teamId, date: "2026-06-14", opponent: "동성중", scoreFor: 7, scoreAgainst: 3, result: "승" as const,
      batting: [
        { playerId: "p6", ab: 4, hits: 3, hr: 1, rbi: 3, sb: 1 },
        { playerId: "p10", ab: 4, hits: 2, hr: 0, rbi: 1, sb: 2 },
        { playerId: "p4", ab: 3, hits: 1, hr: 0, rbi: 1, sb: 0 },
        { playerId: "p7", ab: 4, hits: 1, hr: 0, rbi: 0, sb: 1 },
      ],
      pitching: [
        { playerId: "p1", ip: 5, er: 1, so: 8, bb: 2 },
        { playerId: "p2", ip: 2, er: 2, so: 2, bb: 1 },
      ],
    },
    {
      id: "g2", teamId, date: "2026-06-28", opponent: "한강중", scoreFor: 4, scoreAgainst: 5, result: "패" as const,
      batting: [
        { playerId: "p6", ab: 4, hits: 2, hr: 0, rbi: 1, sb: 0 },
        { playerId: "p10", ab: 4, hits: 1, hr: 0, rbi: 0, sb: 1 },
        { playerId: "p8", ab: 3, hits: 2, hr: 0, rbi: 2, sb: 0 },
      ],
      pitching: [
        { playerId: "p3", ip: 4, er: 3, so: 3, bb: 3 },
        { playerId: "p1", ip: 3, er: 1, so: 5, bb: 1 },
      ],
    },
    {
      id: "g3", teamId, date: "2026-07-05", opponent: "성동리틀", scoreFor: 9, scoreAgainst: 2, result: "승" as const,
      batting: [
        { playerId: "p6", ab: 5, hits: 3, hr: 1, rbi: 4, sb: 0 },
        { playerId: "p4", ab: 4, hits: 2, hr: 0, rbi: 2, sb: 0 },
        { playerId: "p10", ab: 4, hits: 2, hr: 0, rbi: 1, sb: 2 },
        { playerId: "p11", ab: 3, hits: 1, hr: 0, rbi: 1, sb: 1 },
      ],
      pitching: [
        { playerId: "p2", ip: 5, er: 1, so: 6, bb: 2 },
        { playerId: "p3", ip: 2, er: 1, so: 1, bb: 0 },
      ],
    },
  ];

  const events = [
    { id: "e1", teamId, date: "2026-07-15", type: "훈련" as const, title: "하계 대회 대비 특별 훈련", place: "성남 야구장 A" },
    { id: "e2", teamId, date: "2026-07-19", type: "시합" as const, title: "연습경기 vs 분당중", place: "분당 구장" },
    { id: "e3", teamId, date: "2026-07-26", type: "시합" as const, title: "경기도 하계리그 1차전 vs 수원중", place: "수원 야구장" },
  ];

  const codes = [
    { code: "SPTR-PLAYER-01", role: "player" as const, teamId, playerName: "이서진", used: false },
    { code: "SPTR-PLAYER-02", role: "player" as const, teamId, playerName: "강민재", used: false },
    { code: "SPTR-COACH-01", role: "coach" as const, teamId, playerName: null, used: false },
  ];

  return { users, teams, players, feedbacks, training, games, lineups: [], events, codes };
}
