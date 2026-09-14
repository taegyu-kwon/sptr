import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { DB, User, Snapshot } from "./types";
import { buildSeed } from "./seed";

const DB_KEY = "sptr-db-v2";
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
