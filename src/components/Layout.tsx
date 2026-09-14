import React, { useEffect, useRef } from "react";
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
    { to: "/sbi", label: "SBI / SMI", icon: Icon.Calculator },
    { to: "/p/growth", label: "성장 그래프", icon: Icon.TrendingUp },
    { to: "/p/ranking", label: "팀 내 순위", icon: Icon.Trophy },
    { to: "/p/feedback", label: "코칭 피드백", icon: Icon.Message },
    { to: "/p/plan", label: "팀 플랜", icon: Icon.Calendar },
  ],
  coach: [
    { to: "/c/players", label: "선수 프로필", icon: Icon.Users },
    { to: "/c/sbi", label: "SBI / SMI", icon: Icon.ListOrdered },
    { to: "/c/ranking", label: "분야별 랭킹", icon: Icon.Trophy },
    { to: "/c/lineup", label: "라인업", icon: Icon.Grid },
    { to: "/c/feedback", label: "팀 피드백", icon: Icon.Message },
    { to: "/c/training", label: "훈련 일정", icon: Icon.Timer },
    { to: "/c/games", label: "시합 기록", icon: Icon.Clipboard },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, db } = useStore();
  const nav = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);

  // 화면이 바뀌면 활성 탭이 보이도록 탭 줄을 스크롤(모바일)
  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>("a.active");
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [location.pathname]);

  if (!user) return null;
  const team = db.teams.find(t => t.id === user.teamId);
  const items = navByRole[user.role] ?? [];

  const doLogout = () => {
    logout();
    nav("/auth");
  };

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr-row">
          <div className="hdr-brand">
            <BrandMark />
            <span className="wordmark">SPTR</span>
            <span className="hdr-sep" />
            <span className="hdr-team">{team?.name ?? "팀 미지정"}</span>
          </div>
          <div className="hdr-right">
            <div className="hdr-user">
              <Avatar name={user.name} tone={user.role === "coach" ? "violet" : "brand"} size="sm" />
              <div className="who">
                <b>{user.name}</b>
                <span>{roleLabel[user.role]}</span>
              </div>
            </div>
            <button className="icon-btn" title="로그아웃" aria-label="로그아웃" onClick={doLogout}>
              <Icon.LogOut />
            </button>
          </div>
        </div>
        <div className="tabnav-wrap">
          <nav className="tabnav" ref={navRef} aria-label="주 메뉴">
            {items.map(item => {
              const Ic = item.icon;
              return (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
                  <Ic />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="main">{children}</main>
    </div>
  );
}
