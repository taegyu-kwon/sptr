import type { BatHand, Player, PlayerKind, Position, PositionDetail, Snapshot, ThrowHand } from "./types";
import { r1 } from "./format";

/** 선수 등록 시 코치가 입력하는 항목 */
export interface NewPlayerInput {
  name: string;
  positionDetail: PositionDetail;
  throws: ThrowHand;
  bats: BatHand;
  backNumber: number;
  grade: number;
  age: number;
  height: number; // cm
  weight: number; // kg
}

/** 오늘 날짜(YYYY-MM-DD) — 기기 현지 시간 기준. toISOString()은 UTC라 한국 오전 9시 전에는 전날이 된다 */
export const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/* ---------- 포지션 · 투타 ---------- */

export const POSITION_DETAILS: PositionDetail[] = [
  "투수", "포수", "1루수", "2루수", "3루수", "유격수", "좌익수", "중견수", "우익수",
];

/** 세부 포지션 → 큰 포지션(투수·포수·내야수·외야수). 훈련 일정·라인업이 큰 포지션을 쓴다 */
export function groupOf(d: PositionDetail): Position {
  if (d === "투수" || d === "포수") return d;
  if (d === "좌익수" || d === "중견수" || d === "우익수") return "외야수";
  return "내야수";
}

/** 투수 / 야수 */
export const kindOf = (d: PositionDetail): PlayerKind => (d === "투수" ? "투수" : "야수");

/** 세부 포지션이 없는 예전 선수는 큰 포지션 기준으로 대신한다(내야수 → "내야수") */
export const playerPositionDetail = (p: Player): PositionDetail | Position => p.positionDetail ?? p.position;

/** "우투좌타" 형식. 정보가 없으면 null */
export function handLabel(p: Player): string | null {
  if (!p.throws || !p.bats) return null;
  return `${p.throws}투${p.bats}타`;
}

/** 명단 필터 */
export type RosterFilter = "전체" | "투수" | "야수" | "내야수" | "외야수" | "포수";
export const ROSTER_FILTERS: RosterFilter[] = ["전체", "투수", "야수", "내야수", "외야수", "포수"];

export function matchesFilter(p: Player, f: RosterFilter): boolean {
  if (f === "전체") return true;
  if (f === "야수") return p.position !== "투수";
  return p.position === f;
}

/**
 * 새 선수의 첫 측정 기록.
 * 측정 기록이 하나도 없으면 능력치 계산이 동작하지 않으므로, 코치가 등록할 때 입력한 나이·키·몸무게는 그대로 쓰고
 * 나머지는 임시 기본값으로 채운다. 이후 감독·코치가 선수 상세의 '측정 기록 추가'에서 실측값으로 갱신한다(선수는 보기만).
 */
export function makeInitialSnapshot(input: NewPlayerInput): Snapshot {
  const { age, height, weight } = input;
  const kind = kindOf(input.positionDetail);
  return {
    date: today(),
    body: {
      age,
      height,
      weight,
      skeletalMuscle: r1(weight * 0.45),
      bodyFat: 14,
      wingspan: r1(height),
      legLength: r1(height * 0.46),
      heightChange1y: 5,
      weightChange1y: 4,
      jointROM: 70,
      injuryHistory: "",
    },
    athletic: {
      benchPress: 30,
      shoulderPress: 20,
      rowPull: 30,
      squat: 50,
      deadlift: 60,
      dash60: 7.6,
      dash30: 4.3,
      run5kPace: 5.5,
      plankMax: 60,
    },
    practical: {
      kind,
      maxVelo: kind === "투수" ? 110 : 100,
      longThrow: 60,
      command: 60,
      errorRate: 6,
    },
  };
}

/** 팀에서 아직 쓰지 않은 가장 작은 등번호 */
export function nextBackNumber(players: Player[], teamId: string): number {
  const used = new Set(players.filter(p => p.teamId === teamId).map(p => p.backNumber));
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}
