/* ================================================================
   훈련 공지 · 월간 일정 데이터 — 메인 DB(store.tsx)와 따로 저장한다.
   서버 연결(2단계) 전까지 브라우저에만 저장. 예시 데이터는 오늘 날짜 기준으로 만든다.
   ================================================================ */
import { useEffect, useState } from "react";
import type { Position } from "./types";

export type Group = "전체" | "투수조" | "야수조";
export const GROUPS: Group[] = ["전체", "투수조", "야수조"];
export const groupOf = (position: Position): Exclude<Group, "전체"> => (position === "투수" ? "투수조" : "야수조");

export interface NoticeItem {
  id: string;
  start: string; // "16:00"
  end: string; // "17:30"
  group: Group;
  title: string;
  detail?: string;
  place?: string;
}

/** 하루 훈련 공지 — 팀당 날짜 하나에 하나 */
export interface DailyNotice {
  id: string;
  teamId: string;
  date: string; // YYYY-MM-DD
  off: boolean; // 휴식일
  meetTime: string;
  place: string;
  bring: string; // 준비물·복장
  message: string; // 전달 사항
  items: NoticeItem[];
  author: string;
  updatedAt: string;
  /** 선수가 이 공지를 연 기록 — 선수당 마지막으로 연 시각 하나. 예전 저장본에는 없을 수 있음 */
  reads?: NoticeRead[];
}

/** 훈련 공지 읽음 기록 */
export interface NoticeRead {
  playerId: string;
  at: string; // 연 시각 ISO
}

export type GameKind = "연습경기" | "정식대회";

export interface Tournament {
  id: string;
  teamId: string;
  name: string;
  startDate: string;
  endDate: string;
  place: string;
}

export interface ScheduledGame {
  id: string;
  teamId: string;
  date: string;
  time: string;
  kind: GameKind;
  opponent: string;
  place: string;
  tournamentId?: string;
  round?: string; // 예: 1회전, 8강
}

export interface DirectionItem {
  id: string;
  group: Group;
  text: string;
  done: boolean;
}

/** 월별 팀 훈련 방향 */
export interface Direction {
  teamId: string;
  month: string; // YYYY-MM
  theme: string;
  items: DirectionItem[];
}

export interface ScheduleDB {
  seeded: string[]; // 예시 데이터를 만든 팀
  notices: DailyNotice[];
  games: ScheduledGame[];
  tournaments: Tournament[];
  directions: Direction[];
}

/* ---------- 날짜 도우미 (모두 현지 시간) ---------- */

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const todayISO = () => toISO(new Date());
export const addDays = (iso: string, n: number) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const monthOf = (iso: string) => iso.slice(0, 7);
export const addMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
/** 그 주 월요일 */
export const weekStart = (iso: string) => {
  const dow = fromISO(iso).getDay();
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
};
export const daysBetween = (a: string, b: string) =>
  Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
export const dowOf = (iso: string) => WEEKDAYS[fromISO(iso).getDay()];
export const fmtDate = (iso: string) => {
  const d = fromISO(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
};
export const fmtShort = (iso: string) => {
  const d = fromISO(iso);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};
export const dday = (from: string, to: string) => {
  const n = daysBetween(from, to);
  return n === 0 ? "D-DAY" : n > 0 ? `D-${n}` : `D+${-n}`;
};
export const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** 그룹 보기에서 보여 줄 항목인지 — 투수조·야수조 보기에는 팀 전체 항목도 함께 보인다 */
export const visibleIn = (item: { group: Group }, view: Group) =>
  view === "전체" || item.group === "전체" || item.group === view;

/* ---------- 예시 데이터 ---------- */

type Tpl = { meet: string; place: string; bring: string; message: string; items: [string, string, Group, string, string?][] };

const BASE_PLACE = "배명고 야구장";
const TEMPLATES: Record<number, Tpl> = {
  1: {
    meet: "15:40", place: BASE_PLACE, bring: "운동복, 글러브, 러닝화",
    message: "주말 경기 영상 피드백 미팅 후 시작합니다. 개인 스트레칭은 집합 전에 끝내 주세요.",
    items: [
      ["16:00", "16:30", "전체", "팀 미팅 · 웜업", "주말 경기 리뷰 10분 + 다이내믹 스트레칭"],
      ["16:30", "17:30", "투수조", "하체 웨이트 + 밸런스 드릴", "스쿼트 4세트, 싱글레그 밸런스"],
      ["16:30", "17:30", "야수조", "펑고", "내야 100구 / 외야 타구 판단"],
      ["17:30", "18:30", "전체", "팀 배팅", "프리배팅 3조 순환"],
      ["18:30", "18:45", "전체", "쿨다운 · 정리"],
    ],
  },
  2: {
    meet: "15:40", place: BASE_PLACE, bring: "운동복, 글러브, 포수 장비(포수)",
    message: "투수조는 불펜 순서표대로 진행합니다. 야수조는 포수 블로킹 먼저.",
    items: [
      ["16:00", "16:20", "전체", "웜업 · 캐치볼"],
      ["16:20", "17:40", "투수조", "불펜 세션", "존 4분할 타겟 30구, 투구수 기록"],
      ["16:20", "17:40", "야수조", "더블플레이 연계 · 포수 블로킹", "유격수-2루수 피벗 반복"],
      ["17:40", "18:40", "전체", "상황별 주루", "1·3루 상황, 2루→홈 판단"],
    ],
  },
  3: {
    meet: "15:40", place: BASE_PLACE, bring: "운동복, 러닝화, 물통",
    message: "체력 측정이 있는 날입니다. 컨디션 이상이 있으면 미리 코치에게 말해 주세요.",
    items: [
      ["16:00", "16:50", "전체", "기초 체력", "러닝 인터벌, 코어 서킷"],
      ["16:50", "18:00", "투수조", "롱토스 + 플라이오볼", "60m까지 단계별"],
      ["16:50", "18:00", "야수조", "머신 배팅 + 티배팅", "변화구 대응 집중"],
      ["18:00", "18:30", "전체", "60야드 대시 측정", "결과는 측정 기록에 입력"],
    ],
  },
  4: {
    meet: "15:40", place: BASE_PLACE, bring: "운동복, 글러브",
    message: "수비 조직력 점검일입니다. 주자 상황별 콜 플레이를 크게 외칩니다.",
    items: [
      ["16:00", "16:20", "전체", "웜업 · 캐치볼"],
      ["16:20", "17:20", "투수조", "PFP(투수 수비) · 견제", "번트 수비, 1루 커버"],
      ["16:20", "17:20", "야수조", "중계 플레이 · 커버링", "외야→내야 중계 라인"],
      ["17:20", "18:40", "전체", "수비 시뮬레이션", "주자 상황별 실전 수비"],
    ],
  },
  5: {
    meet: "15:40", place: BASE_PLACE, bring: "운동복, 글러브, 배트",
    message: "내일 경기 전 컨디션 조절일입니다. 무리하지 말고 일찍 마칩니다.",
    items: [
      ["16:00", "16:30", "전체", "컨디셔닝 · 가벼운 캐치볼"],
      ["16:30", "17:30", "투수조", "선발 예정자 불펜 20구", "나머지는 섀도 피칭"],
      ["16:30", "17:30", "야수조", "배팅 연습", "상대 선발 유형 맞춤"],
      ["17:30", "17:50", "전체", "내일 경기 미팅", "라인업·집합 시간 안내"],
    ],
  },
  6: {
    meet: "09:30", place: BASE_PLACE, bring: "유니폼(연습복), 글러브, 배트",
    message: "자체 청백전입니다. 조 편성은 현장에서 발표합니다.",
    items: [
      ["10:00", "10:30", "전체", "웜업"],
      ["10:30", "12:30", "전체", "자체 청백전", "투수 1인 2이닝 제한"],
      ["12:30", "13:00", "전체", "경기 리뷰 · 정리"],
    ],
  },
};

const OPPONENTS = ["강동고", "동성고", "한강고", "노원고", "관악고", "마포고", "중랑고"];

/** 예시 선수단(seed.ts)의 선수 id — p1~p24. 예시 공지의 읽음 기록에 쓴다 */
const SEED_PLAYER_IDS = Array.from({ length: 24 }, (_, i) => `p${i + 1}`);
/** 시연용 선수 계정(player@sptr.demo)의 선수 — 오늘 공지는 직접 열어 볼 수 있게 읽지 않은 상태로 둔다 */
const DEMO_PLAYER_ID = "p1";

/** 문자열 → 0~1 고정 난수(예시 데이터가 매번 같게) */
function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * 예시 공지의 읽음 기록 — 지난 공지는 대부분(선수마다 90%쯤) 읽었고, 오늘 공지는 절반쯤만 읽은 상태.
 * 읽은 시각은 공지 작성 시각 뒤, 지금보다 앞이어야 한다(hasRead 기준).
 */
function seedReads(date: string, updatedAt: string, today: string): NoticeRead[] {
  if (date > today) return [];
  const isToday = date === today;
  const written = new Date(updatedAt).getTime();
  const now = Date.now();
  const reads: NoticeRead[] = [];
  for (const playerId of SEED_PLAYER_IDS) {
    if (isToday && playerId === DEMO_PLAYER_ID) continue;
    if (hash01(`${date}:${playerId}`) >= (isToday ? 0.5 : 0.9)) continue;
    // 전날 밤 공지가 올라온 뒤 5분~12시간 사이에 읽은 것으로 둔다
    const at = written + (5 + Math.floor(hash01(`${playerId}:${date}`) * 715)) * 60000;
    reads.push({ playerId, at: new Date(Math.min(at, now - 60000)).toISOString() });
  }
  return reads;
}

function buildScheduleSeed(teamId: string, author: string): Omit<ScheduleDB, "seeded"> {
  const today = todayISO();
  const month = monthOf(today);
  const nextMonth = addMonths(month, 1);

  // 시합: 이번 달·다음 달 토요일은 연습경기, 대회 기간은 대회 경기
  const tournaments: Tournament[] = [];
  const games: ScheduledGame[] = [];

  // 다음 대회: 오늘부터 두 번째 토요일에 시작, 4일간
  const firstSat = addDays(today, (6 - fromISO(today).getDay() + 7) % 7 || 7);
  const t1Start = addDays(firstSat, 7);
  const t1: Tournament = {
    id: "tn-1", teamId, name: "서울 추계 고교 야구 리그", startDate: t1Start, endDate: addDays(t1Start, 3), place: "목동 야구장",
  };
  const t2Start = addDays(t1Start, 28);
  const t2: Tournament = {
    id: "tn-2", teamId, name: "고교 동계 윈터 리그", startDate: t2Start, endDate: addDays(t2Start, 4), place: "부산 기장 드림볼파크",
  };
  tournaments.push(t1, t2);
  games.push(
    { id: "sg-t1a", teamId, date: t1.startDate, time: "10:00", kind: "정식대회", opponent: "성동고", place: "목동 야구장", tournamentId: t1.id, round: "1회전" },
    { id: "sg-t1b", teamId, date: addDays(t1.startDate, 2), time: "13:00", kind: "정식대회", opponent: "은평고", place: "신월 야구장", tournamentId: t1.id, round: "2회전" },
    { id: "sg-t2a", teamId, date: t2.startDate, time: "09:00", kind: "정식대회", opponent: "부산해운고", place: "기장 드림볼파크 1구장", tournamentId: t2.id, round: "조별 1차전" },
    { id: "sg-t2b", teamId, date: addDays(t2.startDate, 1), time: "12:00", kind: "정식대회", opponent: "대구달서고", place: "기장 드림볼파크 2구장", tournamentId: t2.id, round: "조별 2차전" },
  );

  const inTournament = (iso: string) => tournaments.some(t => iso >= t.startDate && iso <= t.endDate);
  let o = 0;
  let d = `${month}-01`;
  const last = addDays(`${addMonths(nextMonth, 1)}-01`, -1);
  while (d <= last) {
    if (fromISO(d).getDay() === 6 && !inTournament(d)) {
      const opp = OPPONENTS[o % OPPONENTS.length];
      games.push({ id: `sg-p${o}`, teamId, date: d, time: "10:00", kind: "연습경기", opponent: opp, place: o % 2 === 0 ? "배명고 야구장 (홈)" : `${opp} 야구장`, });
      o++;
    }
    d = addDays(d, 1);
  }
  // 주중 연습경기 하나(다음 주 수요일)
  const nextWed = addDays(weekStart(today), 9);
  games.push({ id: "sg-mid", teamId, date: nextWed, time: "16:00", kind: "연습경기", opponent: "잠실고", place: "배명고 야구장 (홈)" });

  // 훈련 공지: 지난주 월요일 ~ 다음 주 토요일
  const notices: DailyNotice[] = [];
  // (주의) 대회 기간 중 경기 없는 날은 회복 훈련 공지
  const from = addDays(weekStart(today), -7);
  for (let i = 0; i < 28; i++) {
    const date = addDays(from, i);
    const dow = fromISO(date).getDay();
    if (dow === 0) continue;
    const game = games.find(g => g.date === date);
    let tpl = TEMPLATES[dow];
    if (!game && inTournament(date)) {
      tpl = {
        meet: "10:00", place: BASE_PLACE, bring: "트레이닝복, 러닝화",
        message: "대회 중 경기 없는 날입니다. 회복 위주로 가볍게 움직입니다.",
        items: [
          ["10:00", "10:40", "전체", "회복 러닝 · 스트레칭"],
          ["10:40", "11:20", "투수조", "등판 투수 회복 · 아이싱", "다음 경기 선발은 섀도 피칭만"],
          ["10:40", "11:20", "야수조", "가벼운 티배팅"],
          ["11:20", "11:40", "전체", "다음 경기 미팅"],
        ],
      };
    }
    if (game) {
      const home = game.place.includes("홈");
      tpl = {
        meet: game.time === "10:00" ? "08:30" : addMinutesLabel(game.time, -90),
        place: home ? BASE_PLACE : `${game.place} (학교 앞 버스 출발)`,
        bring: "유니폼, 글러브, 배트, 개인 물통",
        message: `${game.kind} vs ${game.opponent}. 라인업은 경기 전 미팅에서 발표합니다.`,
        items: [
          [addMinutesLabel(game.time, -60), game.time, "전체", "경기 전 웜업 · 캐치볼"],
          [game.time, addMinutesLabel(game.time, 150), "전체", `${game.kind} vs ${game.opponent}`, game.place],
          [addMinutesLabel(game.time, 150), addMinutesLabel(game.time, 180), "전체", "경기 리뷰 · 정리"],
        ],
      };
      if (dow !== 6) {
        // 주중 경기는 수업 후라 투수조 아이싱 추가
        tpl.items.push([addMinutesLabel(game.time, 180), addMinutesLabel(game.time, 200), "투수조", "등판 투수 아이싱 · 투구수 기록"]);
      }
    }
    if (!tpl) continue;
    notices.push({
      id: `nt-${date}`,
      teamId,
      date,
      off: false,
      meetTime: tpl.meet,
      place: tpl.place,
      bring: tpl.bring,
      message: tpl.message,
      items: tpl.items.map(([start, end, group, title, detail], k) => ({ id: `ni-${date}-${k}`, start, end, group, title, detail })),
      author,
      updatedAt: `${addDays(date, -1)}T20:00:00`,
      reads: seedReads(date, `${addDays(date, -1)}T20:00:00`, today),
    });
  }
  // 대회 전날은 휴식 공지
  const restDate = addDays(t1.startDate, -1);
  const restIdx = notices.findIndex(n => n.date === restDate);
  if (restIdx >= 0) notices.splice(restIdx, 1);
  notices.push({
    id: `nt-${addDays(t1.startDate, -1)}`, teamId, date: addDays(t1.startDate, -1), off: true,
    meetTime: "", place: "", bring: "", message: "대회 전날 휴식입니다. 일찍 자고, 내일 07:30 학교 앞 버스 출발입니다.",
    items: [], author, updatedAt: `${addDays(t1.startDate, -2)}T20:00:00`,
  });

  const directions: Direction[] = [
    {
      teamId, month,
      theme: "추계 리그 대비 — 수비 조직력과 투수 이닝 관리",
      items: [
        { id: "dr-1", group: "전체", text: "중계·커버링 실수 줄이기 (수비 시뮬레이션 주 2회)", done: true },
        { id: "dr-2", group: "투수조", text: "선발 3명 투구수 80구까지 단계적으로 늘리기", done: false },
        { id: "dr-3", group: "투수조", text: "견제·번트 수비(PFP) 매주 점검", done: true },
        { id: "dr-4", group: "야수조", text: "변화구 대응 — 티배팅 하루 100개", done: false },
        { id: "dr-5", group: "전체", text: "훈련 전후 스트레칭 루틴 지키기", done: true },
      ],
    },
    {
      teamId, month: nextMonth,
      theme: "동계 체력 강화 — 하체·코어 중심",
      items: [
        { id: "dr-6", group: "전체", text: "주 3회 웨이트 (하체 2 · 상체 1)", done: false },
        { id: "dr-7", group: "투수조", text: "롱토스로 어깨 지구력 만들기", done: false },
        { id: "dr-8", group: "야수조", text: "스윙 스피드 측정 후 개인 목표 정하기", done: false },
      ],
    },
  ];

  return { notices, games, tournaments, directions };
}

/**
 * 예시 예정 경기 목록 — 예시 시합 기록(seed.ts)이 지난 예정 경기와 scheduledGameId 로 연결되도록 같은 목록을 내준다.
 * 오늘 날짜만으로 정해지므로 일정 저장소를 만들 때와 같은 결과가 나온다.
 */
export const seedScheduledGames = (teamId: string): ScheduledGame[] => buildScheduleSeed(teamId, "").games;

function addMinutesLabel(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = Math.max(0, h * 60 + m + mins);
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
}

/* ---------- 저장 ---------- */

// v2: 예시 일정이 고교(서울권) 기준으로 바뀌어 새 키로 시작한다
// v3: 예시 공지에 선수 읽음 기록이 생기고, 지난 예정 경기가 예시 시합 기록과 연결돼 새 키로 시작한다
const KEY = "sptr-schedule-v3";
const empty = (): ScheduleDB => ({ seeded: [], notices: [], games: [], tournaments: [], directions: [] });

function load(): ScheduleDB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...empty(), ...(JSON.parse(raw) as ScheduleDB) };
  } catch {
    // 손상 → 새로 만든다
  }
  return empty();
}

function ensureSeed(db: ScheduleDB, teamId: string, author: string): ScheduleDB {
  if (db.seeded.includes(teamId)) return db;
  const s = buildScheduleSeed(teamId, author);
  return {
    seeded: [...db.seeded, teamId],
    notices: [...db.notices, ...s.notices],
    games: [...db.games, ...s.games],
    tournaments: [...db.tournaments, ...s.tournaments],
    directions: [...db.directions, ...s.directions],
  };
}

/** 팀 일정 데이터. 처음 열 때 그 팀의 예시 데이터를 만든다. */
export function useSchedule(teamId: string) {
  const [sdb, setSdb] = useState<ScheduleDB>(() => ensureSeed(load(), teamId, "박정후 감독"));
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(sdb));
    } catch {
      // 저장 공간 부족 등은 무시(시연용)
    }
  }, [sdb]);
  // 다른 탭(예: 선수 화면)에서 저장한 내용을 받아 온다 — 읽음 표시·일정 수정이 서로 덮어쓰이지 않게
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setSdb(ensureSeed(load(), teamId, "박정후 감독"));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [teamId]);
  const update = (fn: (prev: ScheduleDB) => ScheduleDB) => setSdb(prev => fn(prev));
  return {
    sdb,
    update,
    notices: sdb.notices.filter(n => n.teamId === teamId),
    games: sdb.games.filter(g => g.teamId === teamId).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    tournaments: sdb.tournaments.filter(t => t.teamId === teamId).sort((a, b) => a.startDate.localeCompare(b.startDate)),
    directions: sdb.directions.filter(d => d.teamId === teamId),
  };
}

/** 예시 일정을 오늘 기준으로 다시 만든다(시연용) */
export function resetSchedule(teamId: string) {
  const db = load();
  const keep = <T extends { teamId: string }>(xs: T[]) => xs.filter(x => x.teamId !== teamId);
  const next = ensureSeed(
    { seeded: db.seeded.filter(t => t !== teamId), notices: keep(db.notices), games: keep(db.games), tournaments: keep(db.tournaments), directions: keep(db.directions) },
    teamId,
    "박정후 감독"
  );
  localStorage.setItem(KEY, JSON.stringify(next));
}

/* ---------- 수정 · 읽음 표시 (update()에 넘겨 쓰는 함수들) ---------- */

/** 예정 경기 수정 — id가 같은 경기를 바꾼다 */
export const patchGame = (g: ScheduledGame) => (prev: ScheduleDB): ScheduleDB => ({
  ...prev,
  games: prev.games.map(x => (x.id === g.id ? g : x)),
});

/** 대회 수정 — id가 같은 대회를 바꾼다 */
export const patchTournament = (t: Tournament) => (prev: ScheduleDB): ScheduleDB => ({
  ...prev,
  tournaments: prev.tournaments.map(x => (x.id === t.id ? t : x)),
});

const timeOf = (iso: string) => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** 선수가 이 공지의 "지금 내용"을 확인했는지 — 읽은 뒤에 공지가 수정되면 다시 미확인으로 본다 */
export const hasRead = (n: DailyNotice, playerId: string) => {
  const r = n.reads?.find(x => x.playerId === playerId);
  return !!r && timeOf(r.at) >= timeOf(n.updatedAt);
};
/** 수정 전 내용만 읽은 선수인지 */
export const readBeforeEdit = (n: DailyNotice, playerId: string) => {
  const r = n.reads?.find(x => x.playerId === playerId);
  return !!r && timeOf(r.at) < timeOf(n.updatedAt);
};

/** 선수가 공지를 열었을 때 읽음 기록을 남긴다(선수당 하나, 다시 열면 시각만 갱신) */
export const markNoticeRead = (teamId: string, date: string, playerId: string) => (prev: ScheduleDB): ScheduleDB => ({
  ...prev,
  notices: prev.notices.map(n =>
    n.teamId === teamId && n.date === date
      ? {
          ...n,
          // 예시 공지는 작성 시각이 조금 앞선 것도 있어, 읽은 시각이 작성 시각보다 이르지 않게 맞춘다
          reads: [
            ...(n.reads ?? []).filter(r => r.playerId !== playerId),
            { playerId, at: new Date(Math.max(Date.now(), timeOf(n.updatedAt))).toISOString() },
          ],
        }
      : n
  ),
});
