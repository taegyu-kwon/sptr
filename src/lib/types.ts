export type Role = "player" | "coach";
export type Position = "투수" | "포수" | "내야수" | "외야수";
export type PlayerKind = "투수" | "야수";
/** 세부 포지션 — 명단 필터(투수/내야/외야/포수)와 상세 화면에 쓴다 */
export type PositionDetail =
  | "투수" | "포수"
  | "1루수" | "2루수" | "3루수" | "유격수"
  | "좌익수" | "중견수" | "우익수";
export type ThrowHand = "우" | "좌";
export type BatHand = "우" | "좌" | "양";
/** 경기 구분 */
export type GameType = "정식" | "연습";

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
  /** 세부 포지션. 예전 데이터에는 없을 수 있음 → playerPositionDetail()로 읽는다 */
  positionDetail?: PositionDetail;
  throws?: ThrowHand; // 던지는 손
  bats?: BatHand; // 치는 방향
  records: Snapshot[];
  sbiMetrics?: SbiMetrics;
  /** SBI/SMI 측정 이력(측정일 오름차순). 없으면 sbiMetrics 1건만 있는 예전 데이터 → sbiMetrics는 항상 최신값 */
  sbiHistory?: SbiMetrics[];
  /** 특이사항(재활·부상 등). 없거나 "정상"이면 표시하지 않는다 */
  status?: PlayerStatus;
  /** 보관(졸업·이적·기타). 있으면 명단·순위·라인업·출석에서 빠지고 로그인할 수 없다. 지난 기록은 남는다 */
  archived?: PlayerArchive;
}

export type ArchiveReason = "졸업" | "이적" | "기타";

export interface PlayerArchive {
  reason: ArchiveReason;
  at: string; // 보관한 날 YYYY-MM-DD
}

export type PlayerStatusKind = "정상" | "재활" | "부상" | "휴식" | "기타";

export interface PlayerStatus {
  kind: PlayerStatusKind;
  note?: string;
  returnDate?: string; // 복귀 예정일 ISO
}

export type AttendanceStatus = "출석" | "지각" | "결석" | "사유결석";

/** 훈련일 출석 — 선수·날짜당 하나 */
export interface AttendanceRecord {
  id: string;
  teamId: string;
  playerId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  note?: string;
  /** 체크·수정한 시각 ISO */
  checkedAt?: string;
  /** 누가 기록했나 — 선수 본인 체크 / 코치 수정 */
  source?: "선수" | "코치";
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
  /** 코치가 내용을 고친 시각 ISO (고친 적 없으면 없음) */
  updatedAt?: string;
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
  /* 아래는 나중에 추가된 항목 — 예전 기록에는 없을 수 있어 0으로 본다 */
  doubles?: number; // 2루타
  triples?: number; // 3루타
  runs?: number; // 득점
  bb?: number; // 볼넷(사구 포함)
  so?: number; // 삼진
}

export interface PitchingLine {
  playerId: string;
  ip: number; // ⅓ 단위 표기: 5.1 = 5⅓이닝, 5.2 = 5⅔이닝
  er: number;
  so: number;
  bb: number;
  hits?: number; // 피안타 (예전 기록에는 없을 수 있음)
}

export interface GameRecord {
  id: string;
  teamId: string;
  date: string;
  /** 정식경기 / 연습경기. 예전 기록에는 없을 수 있음 → gameTypeOf()로 읽는다 */
  type?: GameType;
  opponent: string;
  scoreFor: number;
  scoreAgainst: number;
  result: "승" | "패" | "무";
  batting: BattingLine[];
  pitching: PitchingLine[];
  /** 월간 일정(schedule.ts의 ScheduledGame)의 예정 경기 id — "결과 입력"으로 등록한 기록이면 연결된다 */
  scheduledGameId?: string;
}

/** 라인업에서 맡는 수비 위치. 지명타자는 수비에 나가지 않는다 */
export type LineupPos = PositionDetail | "지명타자";

export interface LineupBatter {
  playerId: string;
  pos: LineupPos;
}

/** 정식 경기 라인업 — 팀 기본 1개 + 경기별 전용(선택) */
export interface SavedLineup {
  id: string;
  teamId: string;
  /** null = 정식 경기 기본 라인업. 값이 있으면 월간 일정(schedule.ts의 ScheduledGame) 경기 id의 전용 라인업 */
  gameId: string | null;
  /** 지명타자 사용. 쓰면 투수는 타순 밖(pitcherId), 안 쓰면 타순 중 "투수"가 선발 투수 */
  useDH: boolean;
  order: (LineupBatter | null)[]; // 1~9번
  pitcherId: string | null; // useDH일 때만 의미
  memo: string; // 선수단 전달 사항
  /** false면 코치만 보는 작성 중 상태 */
  published: boolean;
  updatedAt: string;
  author: string;
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
  /** 선수 계정의 주인 — 학부모 코드로 가입하면 "parent"(보기 전용). 없으면 본인 */
  relation?: "self" | "parent";
}

export interface SignupCode {
  code: string;
  role: Role;
  teamId: string;
  playerName: string | null;
  used: boolean;
  /** 연결된 선수 id. 예전 코드에는 없어 이름(playerName)으로 찾는다 */
  playerId?: string;
  issuedAt?: string; // 발급일 YYYY-MM-DD
  expiresAt?: string; // 만료일 YYYY-MM-DD (이 날까지 사용 가능). 없으면 만료 없음(예전 코드)
  /** 코치가 폐기했거나 재발급으로 무효가 된 코드 */
  revoked?: boolean;
  /** 선수 코드의 대상 — 본인 / 학부모. 없으면 본인 */
  relation?: "self" | "parent";
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
  attendance: AttendanceRecord[];
}
