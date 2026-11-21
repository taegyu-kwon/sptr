import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  AttendanceRecord, AttendanceStatus, BatHand, DB, User, Snapshot, SbiMetrics, GameRecord, Player, PlayerStatus, PositionDetail, ThrowHand,
} from "./types";
import { buildSeed } from "./seed";
import { groupOf, makeInitialSnapshot, nextPlayerCode, type NewPlayerInput } from "./roster";
import { migrateLineups } from "./lineup";
import { todayISO } from "./schedule";

// v3: 학년별 24명 명단·세부 포지션·투타·시즌 경기(정식/연습) 예시 데이터로 바뀌어 새 키로 시작한다
const DB_KEY = "sptr-db-v3";
const SESSION_KEY = "sptr-session-v1";

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      // 구버전: sbiMetrics 없으면 시드에서 보강
      if (parsed.players?.some(p => !p.sbiMetrics)) {
        const seed = buildSeed();
        parsed.players = parsed.players.map(p => {
          if (p.sbiMetrics) return p;
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

interface StoreCtx {
  db: DB;
  setDB: (updater: (prev: DB) => DB) => void;
  user: User | null;
  login: (email: string, password: string) => string | null;
  signup: (args: { email: string; password: string; name: string; code: string }) => string | null;
  logout: () => void;
  addSnapshot: (playerId: string, snap: Snapshot) => void;
  /** SBI/SMI 측정 원자료 저장(선수당 최신 1건) */
  saveSbiMetrics: (playerId: string, metrics: SbiMetrics) => void;
  /** 시합 기록 추가 — 결과(승/패/무)는 점수로 계산한다 */
  addGame: (teamId: string, game: Omit<GameRecord, "id" | "teamId" | "result">) => void;
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
  /** 선수와 연결된 계정·피드백·라인업·시합 기록까지 함께 정리 */
  removePlayer: (playerId: string) => void;
  resetDemo: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDBState] = useState<DB>(loadDB);
  const [user, setUser] = useState<User | null>(() => {
    try {
      const id = sessionStorage.getItem(SESSION_KEY);
      if (!id) return null;
      return loadDB().users.find(u => u.id === id) ?? null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }, [db]);

  const value = useMemo<StoreCtx>(() => {
    const setDB = (updater: (prev: DB) => DB) => setDBState(prev => updater(prev));

    return {
      db,
      setDB,
      user,
      login: (email, password) => {
        const u = db.users.find(x => x.email.toLowerCase() === email.trim().toLowerCase());
        if (!u) return "등록되지 않은 이메일입니다.";
        if (u.password !== password) return "비밀번호가 올바르지 않습니다.";
        sessionStorage.setItem(SESSION_KEY, u.id);
        setUser(u);
        return null;
      },
      signup: ({ email, password, name, code }) => {
        const c = db.codes.find(x => x.code === code.trim().toUpperCase());
        if (!c) return "유효하지 않은 가입 코드입니다. 팀에 제공된 개별 코드를 입력하세요.";
        if (c.used) return "이미 사용된 가입 코드입니다.";
        if (db.users.some(u => u.email.toLowerCase() === email.trim().toLowerCase()))
          return "이미 가입된 이메일입니다.";
        if (password.length < 6) return "비밀번호는 6자 이상이어야 합니다.";

        let playerId: string | null = null;
        if (c.role === "player") {
          const p = db.players.find(x => x.teamId === c.teamId && x.name === c.playerName);
          playerId = p?.id ?? null;
          if (!playerId) return "코드에 연결된 선수 정보를 찾을 수 없습니다. 관리자에게 문의하세요.";
        }
        const newUser: User = {
          id: `u-${Date.now()}`,
          email: email.trim(),
          password,
          name: c.role === "player" ? c.playerName! : name.trim() || "코치",
          role: c.role,
          teamId: c.teamId,
          playerId,
        };
        setDB(prev => ({
          ...prev,
          users: [...prev.users, newUser],
          codes: prev.codes.map(x => (x.code === c.code ? { ...x, used: true } : x)),
        }));
        sessionStorage.setItem(SESSION_KEY, newUser.id);
        setUser(newUser);
        return null;
      },
      logout: () => {
        sessionStorage.removeItem(SESSION_KEY);
        setUser(null);
      },
      addSnapshot: (playerId, snap) => {
        setDB(prev => ({
          ...prev,
          players: prev.players.map(p =>
            p.id === playerId ? { ...p, records: [...p.records, snap] } : p
          ),
        }));
      },
      saveSbiMetrics: (playerId, metrics) => {
        setDB(prev => ({
          ...prev,
          players: prev.players.map(p => (p.id === playerId ? { ...p, sbiMetrics: metrics } : p)),
        }));
      },
      addGame: (teamId, game) => {
        const result: GameRecord["result"] =
          game.scoreFor > game.scoreAgainst ? "승" : game.scoreFor < game.scoreAgainst ? "패" : "무";
        const record: GameRecord = { ...game, id: `g-${Date.now()}`, teamId, result };
        setDB(prev => ({ ...prev, games: [...prev.games, record] }));
      },
      removeGame: gameId => {
        setDB(prev => ({ ...prev, games: prev.games.filter(g => g.id !== gameId) }));
      },
      addPlayer: (teamId, input) => {
        const playerId = `p-${Date.now()}`;
        const code = nextPlayerCode(db.codes);
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
          codes: [...prev.codes, { code, role: "player", teamId, playerName: player.name, used: false }],
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
                ? prev.users.map(u => (u.playerId === playerId ? { ...u, name: nextName } : u))
                : prev.users,
          };
        });
      },
      checkIn: (playerId, teamId, date, status, note) => {
        if (!user) return "로그인이 필요합니다.";
        if (user.role === "player" && user.playerId !== playerId) return "본인 출석만 체크할 수 있습니다.";
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
      removePlayer: playerId => {
        setDB(prev => {
          const target = prev.players.find(p => p.id === playerId);
          return {
            ...prev,
            players: prev.players.filter(p => p.id !== playerId),
            users: prev.users.filter(u => u.playerId !== playerId),
            feedbacks: prev.feedbacks.filter(f => f.playerId !== playerId),
            attendance: prev.attendance.filter(a => a.playerId !== playerId),
            codes: target
              ? prev.codes.filter(c => !(c.playerName === target.name && c.teamId === target.teamId))
              : prev.codes,
            lineups: prev.lineups.map(l => ({
              ...l,
              order: l.order.map(b => (b?.playerId === playerId ? null : b)),
              pitcherId: l.pitcherId === playerId ? null : l.pitcherId,
            })),
            games: prev.games.map(g => ({
              ...g,
              batting: g.batting.filter(b => b.playerId !== playerId),
              pitching: g.pitching.filter(p => p.playerId !== playerId),
            })),
          };
        });
      },
      resetDemo: () => {
        const fresh = buildSeed();
        localStorage.setItem(DB_KEY, JSON.stringify(fresh));
        sessionStorage.removeItem(SESSION_KEY);
        setDBState(fresh);
        setUser(null);
      },
    };
  }, [db, user]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("StoreProvider missing");
  return ctx;
}
