import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  AttendanceRecord, AttendanceStatus, BatHand, DB, User, Snapshot, SbiMetrics, GameRecord, Player, PlayerStatus, PositionDetail, ThrowHand,
} from "./types";
import { buildSeed } from "./seed";
import { groupOf, makeInitialSnapshot, type NewPlayerInput } from "./roster";
import { migrateLineups } from "./lineup";
import { buildScheduleSeed, resetSchedule, setServerSchedule, todayISO, type ScheduleDB } from "./schedule";
import { supabase } from "./supabase";
import {
  authErrorText, codeReasonText, createTeam, diffDB, diffSchedule, errorText, loadTeam, myAccount, peekSignupCode,
  redeemSignupCode, uploadSeed, userFrom, type PeekResult, type TeamData, type Writer,
} from "./remote";
import { dropQueue, enqueue, flushWrites, isWriting, setFailureHandler, writeSeq } from "./sync";
import { toast } from "./toast";
import type { ArchiveReason, SignupCode, Team } from "./types";
import { accountOfPlayer, checkSignupCode, codesOfPlayer, newCodeDates, randomCode, relationOf, type CodeCheck } from "./codes";

// v3: 학년별 24명 명단·세부 포지션·투타·시즌 경기(정식/연습) 예시 데이터로 바뀌어 새 키로 시작한다
// v6: 예시 팀이 배명중학교로 바뀌어(상대팀·대회·나이 13~15세) 새 키로 시작한다
// v5: 예시 시합 기록이 월간 일정의 지난 경기와 연결되고, 예시 가입 코드에 발급일·만료일이 생겨 새 키로 시작한다
const DB_KEY = "sptr-db-v6";
const SESSION_KEY = "sptr-session-v1";

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      // 구버전: sbiMetrics 없으면 시드에서 보강
      if (parsed.players?.some(p => !p.sbiMetrics && !p.sbiHistory)) {
        const seed = buildSeed();
        parsed.players = parsed.players.map(p => {
          if (p.sbiMetrics || p.sbiHistory) return p; // 이력을 모두 지운 선수는 미측정 그대로 둔다
          const sp = seed.players.find(x => x.id === p.id);
          return sp?.sbiMetrics ? { ...p, sbiMetrics: sp.sbiMetrics } : p;
        });
        localStorage.setItem(DB_KEY, JSON.stringify(parsed));
      }
      // 라인업: 예전 "선발투수 + 1~9번" 형식 → 타순·수비 위치 형식. 하나도 없으면 예시 기본 라인업을 넣는다
      const needLineup = !parsed.lineups?.length || parsed.lineups.some(l => !Array.isArray((l as { order?: unknown }).order));
      if (needLineup) {
        parsed.lineups = parsed.lineups?.length ? migrateLineups(parsed.lineups, parsed.players) : buildSeed().lineups;
        localStorage.setItem(DB_KEY, JSON.stringify(parsed));
      }
      // 출석·특이사항이 생기기 전 저장본 → 시드의 예시 출석·특이사항으로 보강(남아 있는 선수만)
      if (!Array.isArray(parsed.attendance)) {
        const seed = buildSeed();
        const ids = new Set(parsed.players.map(p => p.id));
        parsed.attendance = seed.attendance.filter(a => ids.has(a.playerId));
        parsed.players = parsed.players.map(p => {
          const sp = seed.players.find(x => x.id === p.id);
          return !p.status && sp?.status ? { ...p, status: sp.status } : p;
        });
        localStorage.setItem(DB_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch {
    // 손상된 저장소 → 재시드
  }
  const db = buildSeed();
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
}

/** 측정일 오름차순(같은 날짜·날짜 없는 예전 기록은 원래 순서 유지, 날짜 없는 기록이 가장 앞) */
function sortByDate<T extends { date?: string }>(list: T[]): T[] {
  return list
    .map((x, i) => ({ x, i }))
    .sort((a, b) => (a.x.date ?? "").localeCompare(b.x.date ?? "") || a.i - b.i)
    .map(o => o.x);
}

/** 체험 모드(이 브라우저의 예시 데이터) / 서버 모드(이메일 로그인, Supabase) */
export type Mode = "demo" | "server";
/**
 * booting: 저장된 로그인 확인 중 · anon: 로그인 전 · loading: 팀 데이터 읽는 중
 * needProfile: 로그인은 됐지만 아직 팀에 가입하지 않음(가입 코드 입력 / 새 팀 시작)
 * newTeam: 방금 팀을 만들어 "예시 데이터 / 빈 팀" 을 고르는 중 · ready: 화면 사용 가능
 */
export type Status = "booting" | "anon" | "loading" | "needProfile" | "newTeam" | "ready";
export type SeedProgress = (label: string, done: number, total: number) => void;

const ARCHIVED_MSG = "보관된 선수 계정입니다. 졸업·이적 등으로 명단에서 빠진 선수의 계정은 로그인할 수 없습니다. 코치에게 문의하세요.";
const CONFIRM_MSG = "확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.";
const rand4 = () => Math.random().toString(36).slice(2, 6);

/** 같은 날짜 측정은 서버에서 1건 — keep(방금 저장한 것)을 남기고 같은 날짜의 다른 기록은 뺀다 */
function onePerDate(list: Snapshot[], keep: Snapshot): Snapshot[] {
  return list.filter(r => r === keep || r.date !== keep.date);
}

interface StoreCtx {
  mode: Mode;
  status: Status;
  /** 서버 모드에서 로그인한 이메일(프로필이 없어도 있다) */
  authEmail: string | null;
  /** 체험 모드로 들어간다 — 서버를 건드리지 않는다 */
  enterDemo: (role: "coach" | "player") => string | null;
  /** 서버 로그인. 실패하면 사유 문구 */
  serverLogin: (email: string, password: string) => Promise<string | null>;
  /** 가입 코드 확인(로그인 전에도 가능) */
  peekCode: (code: string) => Promise<{ error: string | null; info?: PeekResult }>;
  /** 가입 코드로 가입: 코드 확인 → 계정 만들기 → 코드 사용. notice 는 오류가 아닌 안내(확인 메일) */
  serverSignup: (args: { email: string; password: string; name: string; code: string }) => Promise<{ error?: string; notice?: string }>;
  /** 새 팀 시작(코치): 계정 만들기 → 팀 만들기. 성공하면 status 가 newTeam 이 된다 */
  startTeam: (args: { email: string; password: string; name: string; teamName: string; region: string }) => Promise<{ error?: string; notice?: string }>;
  /** 로그인했지만 팀이 없는 계정 — 가입 코드 사용 */
  redeemCode: (code: string, name: string) => Promise<string | null>;
  /** 로그인했지만 팀이 없는 계정 — 새 팀 만들기 */
  createMyTeam: (args: { name: string; teamName: string; region: string }) => Promise<string | null>;
  /** 새 팀의 첫 데이터: 예시 데이터를 올리거나(withSeed) 빈 팀으로 시작 */
  finishNewTeam: (withSeed: boolean, onProgress?: SeedProgress) => Promise<string | null>;
  /** 선수가 한 명도 없는 서버 팀에 예시 데이터를 넣는다(코치) */
  uploadExample: (onProgress?: SeedProgress) => Promise<string | null>;
  /** 비밀번호 변경 — 서버 모드는 Supabase Auth, 체험 모드는 changePassword 와 같다 */
  changePasswordAsync: (current: string, next: string) => Promise<string | null>;
  db: DB;
  setDB: (updater: (prev: DB) => DB) => void;
  user: User | null;
  login: (email: string, password: string) => string | null;
  signup: (args: { email: string; password: string; name: string; code: string }) => string | null;
  logout: () => void;
  addSnapshot: (playerId: string, snap: Snapshot) => void;
  /** 측정 기록 수정 — index는 records 배열 위치. 날짜가 바뀌면 날짜순으로 다시 정렬한다 */
  updateSnapshot: (playerId: string, index: number, snap: Snapshot) => void;
  /** 측정 기록 삭제 — 마지막 1개는 지우지 않는다(능력치 계산에 최소 1개 필요) */
  deleteSnapshot: (playerId: string, index: number) => void;
  /** SBI/SMI 측정을 이력에 추가(같은 측정일은 교체). sbiMetrics는 가장 최근 측정으로 맞춘다 */
  addSbiMetrics: (playerId: string, metrics: SbiMetrics) => void;
  /** SBI/SMI 이력 1건 삭제 — index는 sbiHistory(없으면 [sbiMetrics]) 배열 위치 */
  deleteSbiMetrics: (playerId: string, index: number) => void;
  /** 시합 기록 추가 — 결과(승/패/무)는 점수로 계산한다 */
  addGame: (teamId: string, game: Omit<GameRecord, "id" | "teamId" | "result">) => void;
  /** 시합 기록 수정 — 결과(승/패/무)는 점수로 다시 계산한다 */
  updateGame: (gameId: string, game: Omit<GameRecord, "id" | "teamId" | "result">) => void;
  removeGame: (gameId: string) => void;
  /** 선수 등록 — 첫 측정 기록과 가입 코드를 함께 만든다 */
  addPlayer: (teamId: string, input: NewPlayerInput) => { playerId: string; code: string };
  updatePlayer: (
    playerId: string,
    patch: {
      name?: string; positionDetail?: PositionDetail; throws?: ThrowHand; bats?: BatHand;
      backNumber?: number; grade?: number;
      /** null이면 특이사항을 지운다 */
      status?: PlayerStatus | null;
    }
  ) => void;
  /** 선수 본인 출석 체크·지각/결석 신고(오늘만). 같은 날 본인 기록은 덮어쓴다. 실패하면 사유 문구 */
  checkIn: (playerId: string, teamId: string, date: string, status: AttendanceStatus, note?: string) => string | null;
  /** 코치 출석 수정 — 넘긴 선수만 덮어쓴다. status가 null이면 그 선수 기록을 지워 미체크로 */
  saveAttendance: (
    teamId: string,
    date: string,
    rows: { playerId: string; status: AttendanceStatus | null; note?: string }[]
  ) => void;
  /** 보관된 선수까지 포함한 전체 선수. db.players는 활동 선수만 담는다 — 지난 기록의 이름 표시·보관 목록에만 쓴다 */
  allPlayers: Player[];
  /** 선수 보관(졸업·이적·기타) — 명단·순위·라인업·출석에서 빠지고 계정 로그인이 막힌다. 지난 기록은 남는다 */
  archivePlayer: (playerId: string, reason: ArchiveReason) => void;
  /** 보관 해제. 등번호·이름이 활동 선수와 겹치면 사유 문구를 돌려준다 */
  restorePlayer: (playerId: string) => string | null;
  updateTeam: (teamId: string, patch: Partial<Pick<Team, "name" | "region">>) => void;
  /** 가입 코드 발급(무작위·14일 만료·1회용). 같은 대상의 미사용 코드는 폐기된다(재발급). 발급할 수 없으면 error */
  issueCode: (args: { teamId: string; role: "coach" } | { teamId: string; role: "player"; playerId: string; relation: "self" | "parent" }) => { code?: string; error?: string };
  revokeCode: (code: string) => void;
  /** 가입 화면용 — 코드가 유효한지, 누구 계정으로 가입되는지 */
  checkCode: (code: string) => CodeCheck;
  /** 내 계정 이름 수정 */
  updateAccount: (patch: { name: string }) => string | null;
  changePassword: (current: string, next: string) => string | null;
  resetDemo: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // 체험 모드 데이터(localStorage). 서버 모드 데이터는 여기에 섞지 않는다
  const [demoDb, setDBState] = useState<DB>(loadDB);
  const [demoUser, setUser] = useState<User | null>(() => {
    try {
      const id = sessionStorage.getItem(SESSION_KEY);
      if (!id) return null;
      return loadDB().users.find(u => u.id === id) ?? null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem(DB_KEY, JSON.stringify(demoDb));
  }, [demoDb]);

  /* ---------- 서버 모드 상태 ---------- */
  const [mode, setModeState] = useState<Mode>("demo");
  const [status, setStatusState] = useState<Status>(() => (demoUser ? "ready" : "booting"));
  const [serverDb, setServerDbState] = useState<DB | null>(null); // 메모리에만 둔다
  const [uid, setUid] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const modeRef = useRef<Mode>("demo");
  const statusRef = useRef<Status>(status);
  const serverRef = useRef<DB | null>(null);
  const writerRef = useRef<Writer | null>(null);
  /** 방금 만든 팀의 코치 프로필(예시 데이터 / 빈 팀 선택 전) */
  const pendingProfile = useRef<Record<string, unknown> | null>(null);
  const refreshing = useRef(false);
  const retryQueued = useRef(false);
  /** 로그인·로그아웃이 바뀔 때마다 올라간다 — 늦게 도착한 읽기 결과를 버리는 데 쓴다 */
  const sessionGen = useRef(0);
  const signingOut = useRef<Promise<unknown>>(Promise.resolve());

  const setMode = (m: Mode) => { modeRef.current = m; setModeState(m); };
  const setStatus = (s: Status) => { statusRef.current = s; setStatusState(s); };
  const setServerDb = (d: DB | null) => { serverRef.current = d; setServerDbState(d); };

  const server = useMemo(() => {
    /** 일정 화면(useSchedule)의 수정 → 서버 쓰기 */
    const writeSchedule = (prev: ScheduleDB, next: ScheduleDB) => {
      const w = writerRef.current;
      if (!w) return;
      const { ops, soft } = diffSchedule(prev, next, w);
      enqueue({ ops, soft, rollback: () => setServerSchedule(prev) });
    };
    const apply = (data: TeamData) => {
      // 바뀐 것이 없으면 그대로 둔다(화면을 다시 그리지 않게)
      if (!serverRef.current || JSON.stringify(serverRef.current) !== JSON.stringify(data.db)) setServerDb(data.db);
      setServerSchedule(data.sdb, writeSchedule);
    };
    const clear = () => {
      sessionGen.current++;
      dropQueue();
      writerRef.current = null;
      pendingProfile.current = null;
      setServerDb(null);
      setServerSchedule(null);
      setUid(null);
      setAuthEmail(null);
      setMode("demo");
      setStatus("anon");
    };
    /** 프로필이 있는 계정 → 팀 데이터를 읽어 화면을 연다 */
    const enterTeam = async (profile: Record<string, unknown>) => {
      const me = userFrom(profile);
      const gen = sessionGen.current;
      setMode("server");
      setStatus("loading");
      writerRef.current = { userId: me.id, teamId: me.teamId, role: me.role, relation: me.relation, playerId: me.playerId };
      const data = await loadTeam(me.teamId);
      if (gen !== sessionGen.current) return;
      // 선수·학부모는 남의 프로필을 못 읽는다 — 자기 행은 항상 있게 한다
      if (!data.db.users.some(u => u.id === me.id)) data.db.users.push(me);
      apply(data);
      setUid(me.id);
      setAuthEmail(me.email);
      setStatus("ready");
    };
    /** 로그인 직후·새로고침 뒤: 내 계정 상태를 보고 갈 곳을 정한다. 실패하면 사유 문구 */
    const bootstrap = async (): Promise<string | null> => {
      setMode("server");
      setStatus("loading");
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) { clear(); return "로그인이 만료됐습니다. 다시 로그인해 주세요."; }
        setAuthEmail(s.session.user.email ?? null);
        const acc = await myAccount();
        if (acc.archived) {
          await supabase.auth.signOut({ scope: "local" });
          clear();
          return ARCHIVED_MSG;
        }
        if (!acc.profile) { setStatus("needProfile"); return null; }
        await enterTeam(acc.profile);
        return null;
      } catch (err) {
        // 서버에 못 닿으면 로그인 화면으로(저장된 로그인은 남겨 둬서 새로고침하면 다시 시도한다)
        const msg = errorText(err);
        sessionGen.current++;
        setServerDb(null);
        setServerSchedule(null);
        setMode("demo");
        setStatus("anon");
        return msg;
      }
    };
    /** 쓰기 때문에 다시 읽기를 건너뛰었거나 읽은 결과를 버렸으면, 쓰기가 끝난 뒤 한 번 더 읽는다
        (탭에 들어오자마자 저장하면 옛 화면인 채로 다음 60초까지 남는 것을 막는다) */
    const refreshAfterWrites = () => {
      if (retryQueued.current) return;
      retryQueued.current = true;
      void flushWrites().then(() => window.setTimeout(() => { retryQueued.current = false; void refresh(); }, 300));
    };
    /** 다른 기기의 변경을 반영 — 쓰기가 진행 중이면 쓰기가 끝난 뒤로 미룬다 */
    const refresh = async () => {
      const w = writerRef.current;
      if (modeRef.current !== "server" || statusRef.current !== "ready" || !w) return;
      if (isWriting()) return refreshAfterWrites();
      if (refreshing.current) return;
      refreshing.current = true;
      const seq = writeSeq();
      const gen = sessionGen.current;
      try {
        const data = await loadTeam(w.teamId);
        if (gen !== sessionGen.current) return;
        if (seq !== writeSeq() || isWriting()) return refreshAfterWrites(); // 읽는 사이에 저장함 → 쓰기가 끝난 뒤 다시
        if (!data.db.users.some(u => u.id === w.userId)) {
          // 내 프로필이 안 보인다 = 보관된 선수 계정이 됐거나 로그인이 끊김
          const err = await bootstrap();
          if (err) toast(err);
          return;
        }
        apply(data);
      } catch {
        // 일시적인 연결 문제 — 다음 차례에 다시 읽는다
      } finally {
        refreshing.current = false;
      }
    };
    const seedInto = async (teamId: string, coachName: string, onProgress?: SeedProgress) => {
      const seed = buildSeed();
      const sched = buildScheduleSeed(seed.teams[0].id, coachName);
      await uploadSeed(teamId, seed, sched, onProgress ?? (() => {}));
    };
    return { clear, enterTeam, bootstrap, refresh, seedInto };
  }, []);

  // 시작: 체험 모드 세션이 없으면 저장된 서버 로그인을 확인한다
  useEffect(() => {
    setFailureHandler(err => {
      toast(`${errorText(err)} 방금 변경한 내용은 되돌렸습니다.`);
      window.setTimeout(() => { void server.refresh(); }, 100); // 서버 기준으로 다시 맞춘다
    });
    if (statusRef.current === "booting") {
      supabase.auth.getSession().then(
        ({ data }) => {
          if (statusRef.current !== "booting") return;
          if (!data.session) return setStatus("anon");
          void server.bootstrap().then(err => { if (err) toast(err); });
        },
        () => { if (statusRef.current === "booting") setStatus("anon"); }
      );
    }
    const { data: sub } = supabase.auth.onAuthStateChange(event => {
      // 다른 탭에서 로그아웃했거나 로그인 토큰이 폐기됨
      if (event === "SIGNED_OUT" && modeRef.current === "server") server.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, [server]);

  // 창에 다시 포커스가 오거나 60초마다 팀 데이터를 다시 읽는다
  useEffect(() => {
    if (mode !== "server" || status !== "ready") return;
    const run = () => { if (document.visibilityState !== "hidden") void server.refresh(); };
    const timer = window.setInterval(run, 60000);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [mode, status, server]);

  const isServer = mode === "server" && !!serverDb;
  const db = isServer ? serverDb! : demoDb;
  const user = mode === "server"
    ? (status === "ready" && serverDb ? serverDb.users.find(u => u.id === uid) ?? null : null)
    : demoUser;

  /** 메모리 먼저 고치고(낙관적) 서버 모드면 같은 변경을 서버에 쓴다. 실패하면 되돌린다 */
  const setDB = useCallback((updater: (prev: DB) => DB) => {
    if (modeRef.current !== "server") return setDBState(prev => updater(prev));
    const prev = serverRef.current;
    const w = writerRef.current;
    if (!prev || !w) return;
    const next = updater(prev);
    if (next === prev) return;
    setServerDb(next);
    enqueue({ ops: diffDB(prev, next, w), rollback: () => setServerDb(prev) });
  }, []);

  const value = useMemo<StoreCtx>(() => {
    const signUp = async (email: string, password: string): Promise<{ error?: string; notice?: string }> => {
      await signingOut.current;
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) return { error: authErrorText(error) };
      // 이메일 확인이 켜져 있으면 이미 가입된 주소도 오류 없이 돌아온다(identities 가 빈 배열)
      if (data.user && data.user.identities && data.user.identities.length === 0) return { error: "이미 가입된 이메일입니다. 로그인해 주세요." };
      if (!data.session) return { notice: CONFIRM_MSG };
      setAuthEmail(data.session.user.email ?? email.trim());
      return {};
    };
    const fail = (err: unknown) => errorText(err);

    // 화면에는 활동 선수만 내보낸다(보관 선수는 allPlayers). 보관된 선수의 계정은 로그인 상태로 두지 않는다
    const viewDb: DB = db.players.some(p => p.archived) ? { ...db, players: db.players.filter(p => !p.archived) } : db;
    const activeUser = user?.playerId && db.players.find(p => p.id === user.playerId)?.archived ? null : user;

    return {
      mode,
      status,
      authEmail,
      enterDemo: role => {
        const u = demoDb.users.find(x => x.email === (role === "coach" ? "coach@sptr.demo" : "player@sptr.demo"));
        if (!u) return "체험 계정을 찾을 수 없습니다.";
        if (u.playerId && demoDb.players.find(p => p.id === u.playerId)?.archived)
          return "체험 선수가 보관 상태입니다.";
        if (modeRef.current === "server") {
          // 팀 없는 서버 로그인 상태에서 체험으로 넘어가면 서버 로그인은 끊는다
          server.clear();
          signingOut.current = supabase.auth.signOut({ scope: "local" }).catch(() => {});
        }
        setMode("demo");
        sessionStorage.setItem(SESSION_KEY, u.id);
        setUser(u);
        setStatus("ready");
        return null;
      },
      serverLogin: async (email, password) => {
        await signingOut.current;
        try {
          const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (error) return authErrorText(error);
        } catch (err) {
          return authErrorText(err);
        }
        return server.bootstrap();
      },
      peekCode: async code => {
        try {
          const info = await peekSignupCode(code);
          return { error: info.ok ? null : codeReasonText(info), info };
        } catch (err) {
          return { error: fail(err) };
        }
      },
      serverSignup: async ({ email, password, name, code }) => {
        if (password.length < 6) return { error: "비밀번호는 6자 이상이어야 합니다." };
        try {
          // ① 코드부터 확인(실패한 가입으로 팀 없는 계정만 남지 않게) → ② 계정 만들기 → ③ 코드 사용
          const info = await peekSignupCode(code);
          if (!info.ok) return { error: codeReasonText(info) };
          const made = await signUp(email, password);
          if (made.error || made.notice) return made;
          const res = await redeemSignupCode(code, name);
          if (!res.ok || !res.profile) {
            setMode("server");
            setStatus("needProfile"); // 계정은 생겼다 — 코드만 다시 넣으면 된다
            return { error: codeReasonText({ ...info, reason: res.reason }) };
          }
          await server.enterTeam(res.profile);
          return {};
        } catch (err) {
          if (modeRef.current === "server" && statusRef.current === "loading") void server.bootstrap();
          return { error: fail(err) };
        }
      },
      startTeam: async ({ email, password, name, teamName, region }) => {
        if (password.length < 6) return { error: "비밀번호는 6자 이상이어야 합니다." };
        if (!teamName.trim()) return { error: "팀 이름을 입력하세요." };
        try {
          await peekSignupCode("SPTR-0000-0000"); // 서버가 준비됐는지 먼저 확인(계정만 생기고 끝나지 않게)
          const made = await signUp(email, password);
          if (made.error) return made;
          if (made.notice) return { notice: `${made.notice} 로그인한 뒤 '새 팀 시작'에서 팀을 만들 수 있습니다.` };
          const res = await createTeam(teamName, region, name);
          if (!res.ok || !res.profile) {
            setMode("server");
            setStatus("needProfile");
            return { error: codeReasonText(res) };
          }
          pendingProfile.current = res.profile;
          setMode("server");
          setStatus("newTeam");
          return {};
        } catch (err) {
          return { error: fail(err) };
        }
      },
      redeemCode: async (code, name) => {
        try {
          const res = await redeemSignupCode(code, name);
          if (!res.ok || !res.profile) {
            if (res.reason === "has_profile") return server.bootstrap();
            const info = await peekSignupCode(code).catch(() => null);
            return codeReasonText({ ...(info ?? {}), reason: res.reason });
          }
          await server.enterTeam(res.profile);
          return null;
        } catch (err) {
          if (statusRef.current === "loading") void server.bootstrap();
          return fail(err);
        }
      },
      createMyTeam: async ({ name, teamName, region }) => {
        if (!teamName.trim()) return "팀 이름을 입력하세요.";
        try {
          const res = await createTeam(teamName, region, name);
          if (!res.ok || !res.profile) {
            if (res.reason === "has_profile") return server.bootstrap();
            return codeReasonText(res);
          }
          pendingProfile.current = res.profile;
          setStatus("newTeam");
          return null;
        } catch (err) {
          return fail(err);
        }
      },
      finishNewTeam: async (withSeed, onProgress) => {
        const profile = pendingProfile.current;
        if (!profile) return server.bootstrap();
        try {
          if (withSeed) await server.seedInto(String(profile.team_id), String(profile.name ?? "코치"), onProgress);
          await server.enterTeam(profile);
          pendingProfile.current = null;
          return null;
        } catch (err) {
          setStatus("newTeam"); // 다시 고를 수 있게(예시 올리기는 여러 번 해도 같은 결과)
          return fail(err);
        }
      },
      uploadExample: async onProgress => {
        const w = writerRef.current;
        if (modeRef.current !== "server" || !w || w.role !== "coach") return "서버 모드의 코치만 사용할 수 있습니다.";
        if (db.players.length > 0) return "선수가 이미 등록된 팀에는 예시 데이터를 넣을 수 없습니다.";
        try {
          await flushWrites();
          await server.seedInto(w.teamId, user?.name ?? "코치", onProgress);
          await server.refresh();
          return null;
        } catch (err) {
          return fail(err);
        }
      },
      changePasswordAsync: async (current, next) => {
        if (!user) return "로그인이 필요합니다.";
        if (next.length < 6) return "새 비밀번호는 6자 이상이어야 합니다.";
        if (next === current) return "현재 비밀번호와 다른 비밀번호를 입력하세요.";
        if (modeRef.current !== "server") {
          const me = demoDb.users.find(u => u.id === user.id);
          if (!me || me.password !== current) return "현재 비밀번호가 올바르지 않습니다.";
          setDBState(prev => ({ ...prev, users: prev.users.map(u => (u.id === user.id ? { ...u, password: next } : u)) }));
          setUser({ ...user, password: next });
          return null;
        }
        try {
          // 현재 비밀번호 확인 → 변경
          const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
          if (check.error) {
            const msg = authErrorText(check.error);
            return msg.startsWith("이메일 또는") ? "현재 비밀번호가 올바르지 않습니다." : msg;
          }
          const { error } = await supabase.auth.updateUser({ password: next });
          return error ? authErrorText(error) : null;
        } catch (err) {
          return authErrorText(err);
        }
      },
      db: viewDb,
      setDB,
      user: activeUser,
      login: (email, password) => {
        if (modeRef.current === "server") return "이메일 로그인은 로그인 화면에서 합니다.";
        const u = db.users.find(x => x.email.toLowerCase() === email.trim().toLowerCase());
        if (!u) return "등록되지 않은 이메일입니다.";
        if (u.password !== password) return "비밀번호가 올바르지 않습니다.";
        if (u.playerId && db.players.find(p => p.id === u.playerId)?.archived)
          return "보관된 선수 계정입니다. 졸업·이적 등으로 명단에서 빠진 선수의 계정은 로그인할 수 없습니다. 코치에게 문의하세요.";
        sessionStorage.setItem(SESSION_KEY, u.id);
        setUser(u);
        setStatus("ready");
        return null;
      },
      signup: ({ email, password, name, code }) => {
        if (modeRef.current === "server") return "가입은 로그인 화면에서 합니다.";
        const checked = checkSignupCode(code, db.codes, db.players, db.users);
        if (checked.error || !checked.code) return checked.error ?? "가입 코드를 확인하세요.";
        const c = checked.code;
        const relation = relationOf(c);
        if (db.users.some(u => u.email.toLowerCase() === email.trim().toLowerCase()))
          return "이미 가입된 이메일입니다.";
        if (password.length < 6) return "비밀번호는 6자 이상이어야 합니다.";

        let playerId: string | null = null;
        if (c.role === "player") {
          playerId = checked.player?.id ?? null;
          if (!playerId) return "코드에 연결된 선수 정보를 찾을 수 없습니다. 관리자에게 문의하세요.";
        }
        const newUser: User = {
          id: `u-${Date.now()}`,
          email: email.trim(),
          password,
          name: c.role === "player"
            ? relation === "parent" ? name.trim() || `${checked.player!.name} 학부모` : checked.player!.name
            : name.trim() || "코치",
          role: c.role,
          teamId: c.teamId,
          playerId,
          ...(c.role === "player" ? { relation } : {}),
        };
        setDB(prev => ({
          ...prev,
          users: [...prev.users, newUser],
          codes: prev.codes.map(x => (x.code === c.code ? { ...x, used: true } : x)),
        }));
        sessionStorage.setItem(SESSION_KEY, newUser.id);
        setUser(newUser);
        setStatus("ready");
        return null;
      },
      logout: () => {
        if (modeRef.current === "server") {
          // 남은 쓰기를 마저 보낸 뒤 서버 로그인을 끊는다. 메모리의 팀 데이터는 바로 지운다
          const done = flushWrites();
          signingOut.current = done.then(() => supabase.auth.signOut({ scope: "local" })).catch(() => {});
          sessionGen.current++;
          writerRef.current = null;
          pendingProfile.current = null;
          setServerDb(null);
          setServerSchedule(null);
          setUid(null);
          setAuthEmail(null);
          setMode("demo");
          setStatus("anon");
          return;
        }
        sessionStorage.removeItem(SESSION_KEY);
        setUser(null);
        setStatus("anon");
      },
      addSnapshot: (playerId, snap) => {
        if (user?.role !== "coach") return; // 측정 기록은 감독·코치만 입력한다
        setDB(prev => ({
          ...prev,
          players: prev.players.map(p =>
            p.id === playerId ? { ...p, records: sortByDate(isServer ? onePerDate([...p.records, snap], snap) : [...p.records, snap]) } : p
          ),
        }));
      },
      updateSnapshot: (playerId, index, snap) => {
        if (user?.role !== "coach") return;
        setDB(prev => ({
          ...prev,
          players: prev.players.map(p =>
            p.id === playerId && p.records[index]
              ? { ...p, records: sortByDate(isServer ? onePerDate(p.records.map((r, i) => (i === index ? snap : r)), snap) : p.records.map((r, i) => (i === index ? snap : r))) }
              : p
          ),
        }));
      },
      deleteSnapshot: (playerId, index) => {
        if (user?.role !== "coach") return;
        setDB(prev => ({
          ...prev,
          players: prev.players.map(p =>
            p.id === playerId && p.records.length > 1 && p.records[index]
              ? { ...p, records: p.records.filter((_, i) => i !== index) }
              : p
          ),
        }));
      },
      addSbiMetrics: (playerId, metrics) => {
        if (user?.role !== "coach") return;
        setDB(prev => ({
          ...prev,
          players: prev.players.map(p => {
            if (p.id !== playerId) return p;
            const before = p.sbiHistory ?? (p.sbiMetrics ? [p.sbiMetrics] : []);
            const sbiHistory = sortByDate([...before.filter(m => !m.date || m.date !== metrics.date), metrics]);
            return { ...p, sbiHistory, sbiMetrics: sbiHistory[sbiHistory.length - 1] };
          }),
        }));
      },
      deleteSbiMetrics: (playerId, index) => {
        if (user?.role !== "coach") return;
        setDB(prev => ({
          ...prev,
          players: prev.players.map(p => {
            if (p.id !== playerId) return p;
            const before = p.sbiHistory ?? (p.sbiMetrics ? [p.sbiMetrics] : []);
            if (!before[index]) return p;
            const sbiHistory = before.filter((_, i) => i !== index);
            return { ...p, sbiHistory, sbiMetrics: sbiHistory[sbiHistory.length - 1] };
          }),
        }));
      },
      addGame: (teamId, game) => {
        const result: GameRecord["result"] =
          game.scoreFor > game.scoreAgainst ? "승" : game.scoreFor < game.scoreAgainst ? "패" : "무";
        const record: GameRecord = { ...game, id: isServer ? `g-${Date.now()}-${rand4()}` : `g-${Date.now()}`, teamId, result };
        setDB(prev => ({ ...prev, games: [...prev.games, record] }));
      },
      updateGame: (gameId, game) => {
        const result: GameRecord["result"] =
          game.scoreFor > game.scoreAgainst ? "승" : game.scoreFor < game.scoreAgainst ? "패" : "무";
        setDB(prev => ({
          ...prev,
          games: prev.games.map(g => (g.id === gameId ? { ...g, ...game, result } : g)),
        }));
      },
      removeGame: gameId => {
        setDB(prev => ({ ...prev, games: prev.games.filter(g => g.id !== gameId) }));
      },
      addPlayer: (teamId, input) => {
        const playerId = isServer ? `p-${Date.now()}-${rand4()}` : `p-${Date.now()}`; // 서버에서는 id 가 DB 전체에서 유일해야 한다
        const code = randomCode(db.codes);
        const player: Player = {
          id: playerId,
          name: input.name.trim(),
          teamId,
          position: groupOf(input.positionDetail),
          positionDetail: input.positionDetail,
          throws: input.throws,
          bats: input.bats,
          backNumber: input.backNumber,
          grade: input.grade,
          records: [makeInitialSnapshot(input)],
        };
        setDB(prev => ({
          ...prev,
          players: [...prev.players, player],
          codes: [{ code, role: "player", teamId, playerName: player.name, used: false, playerId, relation: "self", ...newCodeDates() }, ...prev.codes],
        }));
        return { playerId, code };
      },
      updatePlayer: (playerId, patch) => {
        setDB(prev => {
          const before = prev.players.find(p => p.id === playerId);
          const nextName = patch.name?.trim();
          return {
            ...prev,
            players: prev.players.map(p =>
              p.id === playerId
                ? {
                    ...p,
                    name: nextName || p.name,
                    position: patch.positionDetail ? groupOf(patch.positionDetail) : p.position,
                    positionDetail: patch.positionDetail ?? p.positionDetail,
                    throws: patch.throws ?? p.throws,
                    bats: patch.bats ?? p.bats,
                    backNumber: patch.backNumber ?? p.backNumber,
                    grade: patch.grade ?? p.grade,
                    status: patch.status === undefined ? p.status : patch.status ?? undefined,
                  }
                : p
            ),
            // 이름이 바뀌면 이름으로 연결된 가입 코드·계정 표시도 함께 맞춘다
            codes:
              before && nextName && nextName !== before.name
                ? prev.codes.map(c =>
                    c.teamId === before.teamId && c.playerName === before.name ? { ...c, playerName: nextName } : c
                  )
                : prev.codes,
            users:
              before && nextName && nextName !== before.name
                ? prev.users.map(u => (u.playerId === playerId && u.relation !== "parent" ? { ...u, name: nextName } : u))
                : prev.users,
          };
        });
      },
      checkIn: (playerId, teamId, date, status, note) => {
        if (!user) return "로그인이 필요합니다.";
        if (user.role === "player" && user.playerId !== playerId) return "본인 출석만 체크할 수 있습니다.";
        if (user.relation === "parent") return "학부모 계정은 출석을 보기만 할 수 있습니다. 출석 체크는 선수 본인 계정으로 합니다.";
        if (date !== todayISO()) return "출석 체크는 오늘 날짜만 할 수 있습니다.";
        const rec: AttendanceRecord = {
          id: `at-${date}-${playerId}`,
          teamId,
          playerId,
          date,
          status,
          ...(note?.trim() ? { note: note.trim() } : {}),
          checkedAt: new Date().toISOString(),
          source: "선수",
        };
        setDB(prev => ({
          ...prev,
          attendance: [...prev.attendance.filter(a => !(a.playerId === playerId && a.date === date)), rec],
        }));
        return null;
      },
      saveAttendance: (teamId, date, rows) => {
        if (user?.role !== "coach") return;
        const now = new Date().toISOString();
        const ids = new Set(rows.map(r => r.playerId));
        const records: AttendanceRecord[] = rows
          .filter(r => r.status !== null)
          .map(r => ({
            id: `at-${date}-${r.playerId}`,
            teamId,
            playerId: r.playerId,
            date,
            status: r.status!,
            ...(r.note?.trim() ? { note: r.note.trim() } : {}),
            checkedAt: now,
            source: "코치",
          }));
        setDB(prev => ({
          ...prev,
          attendance: [...prev.attendance.filter(a => !(a.date === date && ids.has(a.playerId))), ...records],
        }));
      },
      allPlayers: db.players,
      archivePlayer: (playerId, reason) => {
        setDB(prev => ({
          ...prev,
          players: prev.players.map(p => (p.id === playerId ? { ...p, archived: { reason, at: todayISO() } } : p)),
          // 저장된 라인업에서는 빼 둔다(지난 시합 기록·출석·피드백·계정은 그대로 남긴다)
          lineups: prev.lineups.map(l => ({
            ...l,
            order: l.order.map(b => (b?.playerId === playerId ? null : b)),
            pitcherId: l.pitcherId === playerId ? null : l.pitcherId,
          })),
        }));
      },
      restorePlayer: playerId => {
        const target = db.players.find(p => p.id === playerId);
        if (!target) return "선수를 찾을 수 없습니다.";
        const active = db.players.filter(p => p.teamId === target.teamId && !p.archived);
        const sameNo = active.find(p => p.backNumber === target.backNumber);
        if (sameNo) return `등번호 ${target.backNumber}번을 지금 ${sameNo.name} 선수가 쓰고 있습니다. ${sameNo.name} 선수의 등번호를 바꾼 뒤 복원하세요.`;
        if (active.some(p => p.name === target.name)) return `같은 이름(${target.name})의 활동 선수가 있어 복원할 수 없습니다. 이름을 구분되게 바꾼 뒤 복원하세요.`;
        setDB(prev => ({
          ...prev,
          players: prev.players.map(p => {
            if (p.id !== playerId) return p;
            const { archived: _archived, ...rest } = p;
            return rest;
          }),
        }));
        return null;
      },
      updateTeam: (teamId, patch) => {
        setDB(prev => ({
          ...prev,
          teams: prev.teams.map(t =>
            t.id === teamId ? { ...t, name: patch.name?.trim() || t.name, region: patch.region?.trim() ?? t.region } : t
          ),
        }));
      },
      issueCode: args => {
        if (user?.role !== "coach") return { error: "코치만 가입 코드를 발급할 수 있습니다." };
        const code = randomCode(db.codes);
        const dates = newCodeDates();
        if (args.role === "coach") {
          const rec: SignupCode = { code, role: "coach", teamId: args.teamId, playerName: null, used: false, ...dates };
          setDB(prev => ({ ...prev, codes: [...prev.codes, rec] }));
          return { code };
        }
        const player = db.players.find(p => p.id === args.playerId);
        if (!player || player.archived) return { error: "활동 중인 선수에게만 코드를 발급할 수 있습니다." };
        if (accountOfPlayer(db.users, player.id, args.relation))
          return { error: `${player.name} 선수의 ${args.relation === "parent" ? "학부모" : "본인"} 계정이 이미 있습니다.` };
        // 재발급: 같은 선수·같은 대상의 미사용 코드는 모두 무효로
        const old = new Set(codesOfPlayer(db.codes, player, args.relation).filter(c => !c.used).map(c => c.code));
        const rec: SignupCode = {
          code, role: "player", teamId: player.teamId, playerName: player.name, used: false,
          playerId: player.id, relation: args.relation, ...dates,
        };
        setDB(prev => {
          const rest = prev.codes.map(c => (old.has(c.code) ? { ...c, revoked: true } : c));
          // 본인 코드는 앞에 둔다 — 이름으로 첫 코드를 찾는 화면이 최신 본인 코드를 보게
          return { ...prev, codes: args.relation === "self" ? [rec, ...rest] : [...rest, rec] };
        });
        return { code };
      },
      revokeCode: code => {
        if (user?.role !== "coach") return;
        setDB(prev => ({ ...prev, codes: prev.codes.map(c => (c.code === code && !c.used ? { ...c, revoked: true } : c)) }));
      },
      checkCode: code => checkSignupCode(code, db.codes, db.players, db.users),
      updateAccount: ({ name }) => {
        if (!user) return "로그인이 필요합니다.";
        const next = name.trim();
        if (!next) return "이름을 입력하세요.";
        if (next.length > 20) return "이름은 20자 이내로 입력하세요.";
        if (user.role === "player" && user.relation !== "parent") return "선수 이름은 코치가 선수단 화면에서 수정합니다.";
        setDB(prev => ({ ...prev, users: prev.users.map(u => (u.id === user.id ? { ...u, name: next } : u)) }));
        if (modeRef.current !== "server") setUser({ ...user, name: next });
        return null;
      },
      changePassword: (current, next) => {
        if (!user) return "로그인이 필요합니다.";
        if (modeRef.current === "server") return "서버 모드에서는 changePasswordAsync 를 사용합니다.";
        const me = db.users.find(u => u.id === user.id);
        if (!me || me.password !== current) return "현재 비밀번호가 올바르지 않습니다.";
        if (next.length < 6) return "새 비밀번호는 6자 이상이어야 합니다.";
        if (next === current) return "현재 비밀번호와 다른 비밀번호를 입력하세요.";
        setDB(prev => ({ ...prev, users: prev.users.map(u => (u.id === user.id ? { ...u, password: next } : u)) }));
        setUser({ ...user, password: next });
        return null;
      },
      resetDemo: () => {
        const fresh = buildSeed();
        localStorage.setItem(DB_KEY, JSON.stringify(fresh));
        fresh.teams.forEach(t => resetSchedule(t.id)); // 훈련 공지·월간 일정도 예시로 되돌린다
        sessionStorage.removeItem(SESSION_KEY);
        setDBState(fresh);
        setUser(null);
        if (modeRef.current !== "server") setStatus("anon");
      },
    };
  }, [db, user, demoDb, mode, status, authEmail, isServer, server, setDB]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("StoreProvider missing");
  return ctx;
}
