import type {
  AttendanceRecord, AttendanceStatus, BatHand, BattingLine, DB, GameRecord, GameType, PitchingLine, Player, PlayerKind, PositionDetail, SavedLineup, Snapshot, ThrowHand,
} from "./types";
import { groupOf, kindOf } from "./roster";
import { suggestLineup } from "./lineup";

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

type Spec = { name: string; pos: PositionDetail; throws: ThrowHand; bats: BatHand; grade: number; talent: number };

// 학년별 8명씩 24명. 앞 12명은 예전 예시 데이터와 같은 선수(같은 id·측정값)
const rosterSpec: Spec[] = [
  { name: "김하준", pos: "투수", throws: "우", bats: "우", grade: 3, talent: 0.9 },
  { name: "이서진", pos: "투수", throws: "좌", bats: "좌", grade: 2, talent: 0.65 },
  { name: "박도윤", pos: "투수", throws: "우", bats: "우", grade: 3, talent: 0.5 },
  { name: "최시우", pos: "포수", throws: "우", bats: "우", grade: 3, talent: 0.7 },
  { name: "정예준", pos: "포수", throws: "우", bats: "우", grade: 1, talent: 0.45 },
  { name: "강민재", pos: "유격수", throws: "우", bats: "좌", grade: 3, talent: 0.85 },
  { name: "조은호", pos: "2루수", throws: "우", bats: "우", grade: 2, talent: 0.6 },
  { name: "윤지호", pos: "3루수", throws: "우", bats: "우", grade: 2, talent: 0.55 },
  { name: "임태양", pos: "1루수", throws: "좌", bats: "좌", grade: 1, talent: 0.4 },
  { name: "한결", pos: "중견수", throws: "우", bats: "좌", grade: 3, talent: 0.75 },
  { name: "서준우", pos: "좌익수", throws: "우", bats: "우", grade: 2, talent: 0.5 },
  { name: "문성민", pos: "우익수", throws: "우", bats: "양", grade: 1, talent: 0.35 },
  { name: "오승현", pos: "투수", throws: "우", bats: "우", grade: 1, talent: 0.45 },
  { name: "신우빈", pos: "투수", throws: "우", bats: "좌", grade: 2, talent: 0.55 },
  { name: "배지환", pos: "투수", throws: "좌", bats: "좌", grade: 1, talent: 0.4 },
  { name: "백승우", pos: "투수", throws: "우", bats: "우", grade: 3, talent: 0.7 },
  { name: "홍재원", pos: "1루수", throws: "우", bats: "좌", grade: 3, talent: 0.65 },
  { name: "유건우", pos: "2루수", throws: "우", bats: "우", grade: 1, talent: 0.4 },
  { name: "장민혁", pos: "유격수", throws: "우", bats: "우", grade: 2, talent: 0.6 },
  { name: "노하람", pos: "3루수", throws: "우", bats: "우", grade: 1, talent: 0.35 },
  { name: "송태윤", pos: "포수", throws: "우", bats: "우", grade: 2, talent: 0.5 },
  { name: "황준서", pos: "좌익수", throws: "좌", bats: "좌", grade: 3, talent: 0.6 },
  { name: "안시후", pos: "중견수", throws: "우", bats: "우", grade: 1, talent: 0.45 },
  { name: "남궁현", pos: "우익수", throws: "우", bats: "좌", grade: 2, talent: 0.55 },
];

/* ---------- 시즌 경기 기록 (예시) ---------- */

function makeRng(seed: number) {
  let v = seed;
  return () => {
    v = (v * 16807) % 2147483647;
    return (v - 1) / 2147483646;
  };
}

const FIELD_SPOTS: PositionDetail[] = ["포수", "1루수", "2루수", "3루수", "유격수", "좌익수", "중견수", "우익수"];

/** 일정: [날짜, 구분, 상대] — 2025년 가을 몇 경기 + 2026년 시즌 */
const schedule: [string, GameType, string][] = [
  ["2025-09-13", "연습", "분당고"],
  ["2025-09-27", "정식", "수원고"],
  ["2025-10-11", "정식", "동성고"],
  ["2025-10-25", "연습", "성동리틀"],
  ["2026-03-07", "연습", "분당고"],
  ["2026-03-14", "연습", "용인고"],
  ["2026-03-21", "연습", "성동리틀"],
  ["2026-03-28", "정식", "수원고"],
  ["2026-04-04", "정식", "한강고"],
  ["2026-04-11", "연습", "광명고"],
  ["2026-04-18", "정식", "동성고"],
  ["2026-04-25", "정식", "안양고"],
  ["2026-05-09", "연습", "분당고"],
  ["2026-05-16", "정식", "부천고"],
  ["2026-05-23", "정식", "의정부고"],
  ["2026-05-30", "연습", "용인고"],
  ["2026-06-14", "정식", "동성고"],
  ["2026-06-28", "정식", "한강고"],
  ["2026-07-05", "연습", "성동리틀"],
  ["2026-07-19", "연습", "분당고"],
  ["2026-07-26", "정식", "수원고"],
  ["2026-08-08", "정식", "평택고"],
  ["2026-08-15", "정식", "안산고"],
  ["2026-09-05", "연습", "광명고"],
  ["2026-09-12", "정식", "부천고"],
  ["2026-09-26", "연습", "용인고"],
  ["2026-10-10", "정식", "안양고"],
  ["2026-10-24", "연습", "성동리틀"],
];

function buildGames(teamId: string, players: Player[], talentOf: Map<string, number>): GameRecord[] {
  const rng = makeRng(2026);
  const t = (id: string) => talentOf.get(id) ?? 0.5;
  const pitchers = players.filter(p => p.position === "투수");
  const fielders = players.filter(p => p.position !== "투수");
  const pitcherOrder = [...pitchers].sort((a, b) => t(b.id) - t(a.id));

  return schedule.map(([date, type, opponent], gi) => {
    const official = type === "정식";
    const noise = official ? 0.15 : 0.7; // 연습경기는 기용 폭이 넓다
    const score = (p: Player) => t(p.id) + p.grade * 0.08 + rng() * noise;

    // 수비 위치별 선발 + 지명타자
    const used = new Set<string>();
    const lineup: Player[] = [];
    for (const spot of FIELD_SPOTS) {
      const cands = fielders.filter(p => p.positionDetail === spot && !used.has(p.id));
      if (!cands.length) continue;
      const pick = cands.reduce((a, b) => (score(b) > score(a) ? b : a));
      used.add(pick.id);
      lineup.push(pick);
    }
    const rest = fielders.filter(p => !used.has(p.id));
    const dh = rest.reduce((a, b) => (score(b) > score(a) ? b : a));
    used.add(dh.id);
    lineup.push(dh);
    // 연습경기는 교체 선수 2명이 한두 타석씩
    const subs = official ? [] : fielders.filter(p => !used.has(p.id)).sort(() => rng() - 0.5).slice(0, 2);

    const batLine = (p: Player, pa: number): BattingLine => {
      const tl = t(p.id);
      const line: BattingLine = { playerId: p.id, ab: 0, hits: 0, hr: 0, rbi: 0, sb: 0, doubles: 0, triples: 0, runs: 0, bb: 0, so: 0 };
      for (let i = 0; i < pa; i++) {
        if (rng() < 0.07 + 0.06 * tl) {
          line.bb! += 1;
          if (rng() < 0.3 + 0.2 * tl) line.runs! += 1;
          if (tl > 0.5 && rng() < 0.18) line.sb += 1;
          continue;
        }
        line.ab += 1;
        if (rng() < 0.19 + 0.18 * tl) {
          line.hits += 1;
          const k = rng();
          if (k < 0.02 + 0.07 * tl) { line.hr += 1; line.runs! += 1; line.rbi += 1 + (rng() < 0.4 ? 1 : 0); }
          else if (k < 0.05 + 0.08 * tl) { line.triples! += 1; if (rng() < 0.6) line.runs! += 1; if (rng() < 0.5) line.rbi += 1; }
          else if (k < 0.22 + 0.12 * tl) { line.doubles! += 1; if (rng() < 0.45) line.runs! += 1; if (rng() < 0.4) line.rbi += 1; }
          else { if (rng() < 0.35) line.runs! += 1; if (rng() < 0.3) line.rbi += 1; if (tl > 0.45 && rng() < 0.2) line.sb += 1; }
        } else if (rng() < 0.3 - 0.12 * tl) {
          line.so! += 1;
        }
      }
      return line;
    };
    const batting = [
      ...lineup.map((p, i) => batLine(p, i < 4 ? 4 + (rng() < 0.4 ? 1 : 0) : 3 + (rng() < 0.6 ? 1 : 0))),
      ...subs.map(p => batLine(p, 1 + (rng() < 0.5 ? 1 : 0))),
    ];

    // 투구: 7이닝(21아웃)을 선발 + 계투로 나눈다
    const starter = official
      ? pitcherOrder[gi % 4]
      : pitchers[Math.floor(rng() * pitchers.length)];
    const others = pitchers.filter(p => p.id !== starter.id).sort(() => rng() - 0.5);
    const outsPlan: [Player, number][] = [];
    let left = 21;
    const startOuts = Math.min(left, Math.round(9 + t(starter.id) * 9 + rng() * 3));
    outsPlan.push([starter, startOuts]);
    left -= startOuts;
    for (const rp of others) {
      if (left <= 0) break;
      const o = left <= 6 ? left : Math.round(3 + rng() * 4);
      outsPlan.push([rp, o]);
      left -= o;
    }
    const pitching: PitchingLine[] = outsPlan.map(([p, outs]) => {
      const tl = t(p.id);
      const inn = outs / 3;
      const vary = () => 0.55 + rng() * 0.9;
      return {
        playerId: p.id,
        ip: Math.floor(outs / 3) + (outs % 3) / 10,
        er: Math.round(inn * (0.85 - 0.6 * tl) * vary()),
        so: Math.round(inn * (0.7 + 0.75 * tl) * vary()),
        bb: Math.round(inn * (0.65 - 0.35 * tl) * vary()),
        hits: Math.round(inn * (1.25 - 0.6 * tl) * vary()),
      };
    });

    const scoreFor = batting.reduce((sum, b) => sum + (b.runs ?? 0), 0);
    const scoreAgainst = pitching.reduce((sum, p) => sum + p.er, 0) + (rng() < 0.3 ? 1 : 0);
    const result: GameRecord["result"] = scoreFor > scoreAgainst ? "승" : scoreFor < scoreAgainst ? "패" : "무";
    return { id: `g${gi + 1}`, teamId, date, type, opponent, scoreFor, scoreAgainst, result, batting, pitching };
  });
}

/* ---------- 특이사항 · 출석 (예시) ---------- */

/** 특이사항 예시: [선수 id, 상태, 시작일] — 시작일부터 훈련은 사유결석 */
const statusSpec: [string, NonNullable<Player["status"]>, string][] = [
  ["p8", { kind: "재활", note: "팔꿈치 통증 — 송구 제한, 하체 위주 재활", returnDate: "2026-11-20" }, "2026-10-26"],
  ["p15", { kind: "부상", note: "왼쪽 발목 염좌", returnDate: "2026-12-05" }, "2026-10-30"],
  ["p13", { kind: "휴식", note: "성장통 관리로 투구 휴식" }, ""],
];

/** 2026-10-05 ~ 11-04 훈련일(월·수·금 + 격주 토) 출석. 고정 난수라 항상 같다 */
function buildAttendance(teamId: string, players: Player[]): AttendanceRecord[] {
  const rng = makeRng(1105);
  const pad = (n: number) => String(n).padStart(2, "0");
  const days: string[] = [];
  let saturdays = 0;
  for (let d = new Date(2026, 9, 5); d <= new Date(2026, 10, 4); d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 1 || dow === 3 || dow === 5 || (dow === 6 && saturdays++ % 2 === 0))
      days.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }
  const out: AttendanceRecord[] = [];
  for (const date of days) {
    for (const p of players) {
      const st = statusSpec.find(([id, s, from]) => id === p.id && from && s.kind !== "휴식" && date >= from);
      let status: AttendanceStatus = "출석";
      let note: string | undefined;
      if (st) {
        status = "사유결석";
        note = st[1].kind;
      } else {
        const r = rng();
        if (r < 0.05) status = "지각";
        else if (r < 0.075) status = "결석";
        else if (r < 0.1) { status = "사유결석"; note = rng() < 0.5 ? "병원 진료" : "학교 행사"; }
      }
      // 선수가 훈련 전후(15:40~16:10)에 직접 체크한 것으로 둔다. 지각은 그보다 늦게
      const min = status === "지각" ? 20 + Math.floor(rng() * 25) : Math.floor(rng() * 31) - 20;
      const t = new Date(`${date}T16:00:00`);
      t.setMinutes(t.getMinutes() + min);
      out.push({
        id: `at-${date}-${p.id}`, teamId, playerId: p.id, date, status, ...(note ? { note } : {}),
        checkedAt: t.toISOString(), source: "선수",
      });
    }
  }
  return out;
}

export function buildSeed(): DB {
  seedVal = 42;
  const teamId = "t-seongnam";
  const teams = [{ id: teamId, name: "배명고등학교 야구부", region: "서울 송파" }];

  const players: Player[] = rosterSpec.map((spec, i) => {
    const records = makeSnapshots({
      age: 15 + spec.grade,
      height: between(158, 176) + spec.talent * 4,
      weight: between(48, 68) + spec.talent * 6,
      kind: kindOf(spec.pos),
      talent: spec.talent,
    });
    const t = spec.talent;
    return {
      id: `p${i + 1}`,
      name: spec.name,
      teamId,
      position: groupOf(spec.pos),
      positionDetail: spec.pos,
      throws: spec.throws,
      bats: spec.bats,
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

  const talentOf = new Map(players.map((p, i) => [p.id, rosterSpec[i].talent]));
  const games = buildGames(teamId, players, talentOf);

  const events = [
    { id: "e1", teamId, date: "2026-07-15", type: "훈련" as const, title: "하계 대회 대비 특별 훈련", place: "배명고 야구장" },
    { id: "e2", teamId, date: "2026-07-19", type: "시합" as const, title: "연습경기 vs 분당고", place: "분당 구장" },
    { id: "e3", teamId, date: "2026-07-26", type: "시합" as const, title: "하계리그 1차전 vs 수원고", place: "수원 야구장" },
  ];

  const codes = [
    { code: "SPTR-PLAYER-01", role: "player" as const, teamId, playerName: "이서진", used: false },
    { code: "SPTR-PLAYER-02", role: "player" as const, teamId, playerName: "강민재", used: false },
    { code: "SPTR-COACH-01", role: "coach" as const, teamId, playerName: null, used: false },
  ];

  // 정식 경기 기본 라인업 예시 — 추천 자동 배치 결과에 감독 메모를 붙인다
  const base = suggestLineup(players, games, true);
  // 대회 2회전(월간 일정 예시 경기 id "sg-t1b")은 1회전 선발이 이틀 쉬어야 해서 2번째 투수가 선발
  const evalTotal = (p: Player) => talentOf.get(p.id) ?? 0;
  const secondSp = players
    .filter(p => p.position === "투수" && p.id !== base.pitcherId)
    .sort((a, b) => evalTotal(b) - evalTotal(a))[0];
  const lineups: SavedLineup[] = [
    {
      id: "lu-default", teamId, gameId: null, ...base,
      memo: "정식 경기 기본 라인업입니다. 상대 선발 유형에 따라 경기별로 일부 바꿀 수 있습니다.",
      published: true, updatedAt: "2026-11-01T20:00:00", author: "박정후 감독",
    },
    {
      id: "lu-sg-t1b", teamId, gameId: "sg-t1b", ...base, pitcherId: secondSp?.id ?? base.pitcherId,
      memo: "1회전 선발은 투구수 관리로 이틀 휴식합니다. 2회전 선발은 " + (secondSp?.name ?? "") + ", 타순은 기본과 같습니다.",
      published: true, updatedAt: "2026-11-02T20:00:00", author: "박정후 감독",
    },
  ];
  for (const [id, status] of statusSpec) {
    const p = players.find(x => x.id === id);
    if (p) p.status = status;
  }
  const attendance = buildAttendance(teamId, players);

  return { users, teams, players, feedbacks, training, games, lineups, events, codes, attendance };
}
