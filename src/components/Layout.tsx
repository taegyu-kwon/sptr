import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";

const roleLabel: Record<string, string> = {
  player: "선수 / 학부모",
  coach: "코칭스태프",
};

const navByRole: Record<string, { to: string; label: string }[]> = {
  player: [
    { to: "/p/stats", label: "내 능력치" },
    { to: "/p/input", label: "데이터 입력" },
    { to: "/sbi", label: "SBI / SMI 계산기" },
    { to: "/p/growth", label: "성장 그래프" },
    { to: "/p/ranking", label: "팀 내 순위" },
    { to: "/p/feedback", label: "코칭 피드백" },
    { to: "/p/plan", label: "팀 플랜" },
  ],
  coach: [
    { to: "/c/players", label: "선수 프로필" },
    { to: "/c/sbi", label: "SBI/SMI 리스트" },
    { to: "/c/ranking", label: "분야별 랭킹" },
    { to: "/c/lineup", label: "라인업 시뮬레이션" },
    { to: "/c/feedback", label: "팀 피드백" },
    { to: "/c/training", label: "훈련 일정" },
    { to: "/c/games", label: "시합 기록" },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, db } = useStore();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  if (!user) return null;
  const team = db.teams.find(t => t.id === user.teamId);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-name">{team?.name ?? "SPTR"}</div>
        </div>
        <div className="sidebar-footer" ref={menuRef}>
          {menuOpen && (
            <div className="user-menu">
              <div className="user-menu-head">
                <div className="name">{user.name}</div>
                <div className="role">{team?.name ?? roleLabel[user.role]}</div>
              </div>
              <div className="menu-nav">
                {navByRole[user.role].map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `user-menu-item${isActive ? " active" : ""}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
              <button
                className="user-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                  nav("/auth");
                }}
              >
                로그아웃
              </button>
            </div>
          )}
          <button
            className="menu-btn"
            aria-label="메뉴"
            onClick={() => setMenuOpen(o => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
