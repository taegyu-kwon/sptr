import type { Player, PlayerKind, Position, Snapshot, SignupCode } from "./types";

/** 선수 등록 시 코치가 입력하는 항목 */
export interface NewPlayerInput {
  name: string;
  position: Position;
  backNumber: number;
  grade: number;
  kind: PlayerKind;
  age: number;
  height: number; // cm
  weight: number; // kg
}

export const today = () => new Date().toISOString().slice(0, 10);

/**
 * 새 선수의 첫 측정 기록.
 * 측정 기록이 하나도 없으면 능력치 계산이 동작하지 않으므로, 코치가 입력한 기본 항목은 그대로 쓰고
 * 나머지는 U15 평균 수준의 기본값으로 채운다. 이후 선수가 '데이터 입력'에서 실측값으로 갱신한다.
 */
export function makeInitialSnapshot(input: NewPlayerInput): Snapshot {
  const { age, height, weight, kind } = input;
  const r1 = (v: number) => Math.round(v * 10) / 10;
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

/** SPTR-PLAYER-01 형식의 다음 가입 코드 */
export function nextPlayerCode(codes: SignupCode[]): string {
  const nums = codes
    .map(c => /^SPTR-PLAYER-(\d+)$/.exec(c.code)?.[1])
    .filter((x): x is string => !!x)
    .map(Number);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `SPTR-PLAYER-${String(next).padStart(2, "0")}`;
}
