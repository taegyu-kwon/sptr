import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { Icon, BrandMark } from "./icons";
import { Avatar } from "./ui";

const roleLabel: Record<string, string> = {
  player: "선수 / 학부모",
  coach: "코칭스태프",
};

type NavItem = { to: string; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> };

const navByRole: Record<string, NavItem[]> = {
  player: [
    { to: "/p/stats", label: "내 능력치", icon: Icon.Gauge },
    { to: "/p/input", label: "데이터 입력", icon: Icon.PenLine },
    { to: "/sbi", label: "SBI / SMI 계산기", icon: Icon.Calculator },
    { to: "/p/growth", label: "성장 그래프", icon: Icon.TrendingUp },
    { to: "/p/ranking", label: "팀 내 순위", icon: Icon.Trophy },
    { to: "/p/feedback", label: "코칭 피드백", icon: Icon.Message },
    { to: "/p/plan", label: "팀 플랜", icon: Icon.Calendar },
  ],
  coach: [
    { to: "/c/players", label: "선수 프로필", icon: Icon.Users },
    { to: "/c/sbi", label: "SBI / SMI 리스트", icon: Icon.ListOrdered },
    { to: "/c/ranking", label: "분야별 랭킹", icon: Icon.Trophy },
    { to: "/c/lineup", label: "라인업 시뮬레이션", icon: Icon.Grid },
    { to: "/c/feedback", label: "팀 피드백", icon: Icon.Message },
    { to: "/c/training", label: "훈련 일정", icon: Icon.Timer },
    { to: "/c/games", label: "시합 기록", icon: Icon.Clipboard },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, db } = useStore();
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // 화면이 바뀌면 드로어를 닫고, 열려 있는 동안엔 뒤 화면이 스크롤되지 않게
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!user) return null;
  const team = db.teams.find(t => t.id === user.teamId);
  const items = navByRole[user.role] ?? [];

  const doLogout = () => {
    setOpen(false);
    logout();
    nav("/auth");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-btn lg" aria-label="메뉴 열기" onClick={() => setOpen(true)}>
          <Icon.Menu />
        </button>
        <div className="topbar-brand">
          <BrandMark />
          <span>{team?.name ?? "SPTR"}</span>
        </div>
        <Avatar name={user.name} small />
      </header>

      <div className={`scrim${open ? " show" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />

      <aside className={`sidebar${open ? " open" : ""}`} aria-label="주 메뉴">
        <div className="brand">
          <BrandMark />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="brand-name">SPTR</div>
            <div className="brand-sub">{team?.name ?? "팀 미지정"}</div>
          </div>
          <button className="icon-btn only-mobile" aria-label="메뉴 닫기" onClick={() => setOpen(false)}>
            <Icon.X />
          </button>
        </div>

        <nav className="nav">
          <div className="nav-label">{roleLabel[user.role]}</div>
          {items.map(item => {
            const Ic = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              >
                <Ic />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="user">
            <Avatar name={user.name} tone={user.role === "coach" ? "violet" : "brand"} />
            <div>
              <div className="user-name">{user.name}</div>
              <div className="user-role">{roleLabel[user.role]}</div>
            </div>
            <button className="icon-btn" title="로그아웃" aria-label="로그아웃" onClick={doLogout}>
              <Icon.LogOut />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
