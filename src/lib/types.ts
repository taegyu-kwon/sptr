export type Role = "player" | "coach";
export type Position = "투수" | "포수" | "내야수" | "외야수";
export type PlayerKind = "투수" | "야수";

export interface BodyData {
  age: number;
  height: number; // cm
  weight: number; // kg
  skeletalMuscle: number; // 골격근량 kg
  bodyFat: number; // 체지방 %
  wingspan: number; // cm
  legLength: number; // cm
  heightChange1y: number; // 최근 1년 키 변화 cm
  weightChange1y: number; // 최근 1년 몸무게 변화 kg
  jointROM: number; // 근위 관절 가동범위 종합 (0-100)
  injuryHistory: string; // 쉼표 구분
}

export interface AthleticData {
  benchPress: number; // kg
  shoulderPress: number; // kg
  rowPull: number; // kg
  squat: number; // kg
  deadlift: number; // kg
  dash60: number; // sec (60yd)
  dash30: number; // sec (30yd)
  run5kPace: number; // min/km
  plankMax: number; // sec
}

export interface PracticalData {
  kind: PlayerKind;
  maxVelo: number; // km/h 최고 구속(투수) / 송구 속도(야수)
  longThrow: number; // m 멀리 던지기
  command: number; // 0-100 커맨드/송구 정확도
  errorRate: number; // % 에러율
}

export interface Snapshot {
  date: string; // ISO
  body: BodyData;
  athletic: AthleticData;
  practical: PracticalData;
}

/** U15 SBI/SMI 원자료 (덤벨 반복·역학 검사) */
export interface SbiMetrics {
  date?: string; // 측정일 ISO (예전 데이터에는 없을 수 있음)
  sprint: number; // 10m 초
  vertical: number; // cm
  squatReps: number;
  deadReps: number;
  pushReps: number;
  landDist: number; // 착지거리 cm
  upperOnly: number; // 하체고정 메디신볼 m
  fullBody: number; // 전신 투구폼 m
  elbowThrow: number; // 무릎 꿇고 메디신볼 m (Method 2)
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  position: Position;
  backNumber: number;
  grade: number; // 학년
  records: Snapshot[];
  sbiMetrics?: SbiMetrics;
}

export interface Team {
  id: string;
  name: string;
  region: string;
}

export interface FeedbackItem {
  id: string;
  teamId: string;
  playerId: string | null; // null = 팀 전체 피드백
  author: string;
  date: string;
  category: string;
  content: string;
}

export interface TrainingSlot {
  id: string;
  teamId: string;
  day: string; // 월~일
  position: Position | "전체";
  time: string;
  content: string;
}

export interface BattingLine {
  playerId: string;
  ab: number;
  hits: number;
  hr: number;
  rbi: number;
  sb: number;
}

export interface PitchingLine {
  playerId: string;
  ip: number;
  er: number;
  so: number;
  bb: number;
}

export interface GameRecord {
  id: string;
  teamId: string;
  date: string;
  opponent: string;
  scoreFor: number;
  scoreAgainst: number;
  result: "승" | "패" | "무";
  batting: BattingLine[];
  pitching: PitchingLine[];
}

export interface SavedLineup {
  teamId: string;
  updatedAt: string;
  slots: Record<string, string>; // 슬롯 키("선발투수", "1번"~"9번") -> playerId
}

export interface UpcomingEvent {
  id: string;
  teamId: string;
  date: string;
  type: "훈련" | "시합";
  title: string;
  place: string;
}

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  teamId: string;
  playerId: string | null; // player 전용
}

export interface SignupCode {
  code: string;
  role: Role;
  teamId: string;
  playerName: string | null;
  used: boolean;
}

export interface DB {
  users: User[];
  teams: Team[];
  players: Player[];
  feedbacks: FeedbackItem[];
  training: TrainingSlot[];
  games: GameRecord[];
  lineups: SavedLineup[];
  events: UpcomingEvent[];
  codes: SignupCode[];
}
