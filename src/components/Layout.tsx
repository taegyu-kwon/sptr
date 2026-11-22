import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { Icon, BrandMark } from "./icons";
import { Avatar } from "./ui";
import "../styles/server.css";

type NavItem = { to: string; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> };

const navByRole: Record<string, NavItem[]> = {
  coach: [
    { to: "/c/overview", label: "팀 대시보드", icon: Icon.Gauge },
    { to: "/c/players", label: "선수단", icon: Icon.Users },
    { to: "/c/team", label: "팀 관리", icon: Icon.Shield },
    { to: "/c/sbi", label: "SBI / SMI 분석", icon: Icon.TrendingUp },
    { to: "/c/ranking", label: "분야별 랭킹", icon: Icon.Trophy },
    { to: "/c/lineup", label: "경기 라인업", icon: Icon.Grid },
    { to: "/c/games", label: "시합 기록", icon: Icon.Clipboard },
    { to: "/c/centers", label: "측정 센터 지도", icon: Icon.MapPin },
    { to: "/c/calendar", label: "팀 캘린더", icon: Icon.Calendar },
    { to: "/c/notice", label: "훈련 공지", icon: Icon.Timer },
    { to: "/c/attendance", label: "출석 관리", icon: Icon.Check },
    { to: "/c/feedback", label: "코칭 피드백", icon: Icon.Message },
  ],
  player: [
    { to: "/p/stats", label: "내 능력치", icon: Icon.Gauge },
    { to: "/p/growth", label: "성장 그래프", icon: Icon.TrendingUp },
    { to: "/p/input", label: "측정 기록", icon: Icon.PenLine },
    { to: "/sbi", label: "SBI / SMI 분석", icon: Icon.Calculator },
    { to: "/p/ranking", label: "팀 내 순위", icon: Icon.Trophy },
    { to: "/p/centers", label: "측정 센터 지도", icon: Icon.MapPin },
    { to: "/p/calendar", label: "팀 캘린더", icon: Icon.Calendar },
    { to: "/p/notice", label: "훈련 공지", icon: Icon.Timer },
    { to: "/p/attendance", label: "출석 체크", icon: Icon.Check },
    { to: "/p/plan", label: "예상 라인업", icon: Icon.Grid },
    { to: "/p/feedback", label: "코칭 피드백", icon: Icon.Message },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, db, mode } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  /** 탭 줄이 넘칠 때 어느 쪽에 더 있는지 — 양끝 페이드·화살표를 켠다 */
  const [more, setMore] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setMore(m => (m.left === left && m.right === right ? m : { left, right }));
  }, []);

  // 화면이 바뀌면 맨 위로, 그리고 활성 탭이 보이도록 탭 줄을 스크롤
  useEffect(() => {
    window.scrollTo(0, 0);
    const nav = navRef.current;
    const el = nav?.querySelector<HTMLElement>("a.active");
    if (nav && el) {
      const to = el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2;
      nav.scrollTo({ left: Math.max(0, to), behavior: "auto" });
    }
    measure();
  }, [location.pathname, measure]);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    // 마우스 휠(세로)로도 탭 줄을 가로로 넘길 수 있게
    const wheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const before = el.scrollLeft;
      el.scrollLeft += e.deltaY;
      if (el.scrollLeft !== before) e.preventDefault();
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      el.removeEventListener("wheel", wheel);
    };
  }, [measure, user?.role]);

  if (!user) return null;
  const team = db.teams.find(t => t.id === user.teamId);
  const items = navByRole[user.role] ?? [];
  const home = user.role === "coach" ? "/c/overview" : "/p/stats";
  const roleLabel = user.role === "coach"
    ? "코칭스태프"
    : user.relation === "parent"
      ? `${db.players.find(p => p.id === user.playerId)?.name ?? ""} 선수 학부모`
      : "선수";
  const doLogout = () => { logout(); navigate("/auth"); };
  const slide = (dir: 1 | -1) => {
    const el = navRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.6), behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById("main-content")?.focus(); }}>본문으로 건너뛰기</a>
      <header className="hdr">
        <div className="hdr-row">
          <div className="hdr-brand">
            <Link to={home} className="hdr-home" aria-label="SPTR 홈">
              <BrandMark />
              <span className="wordmark">SPTR<i>.</i></span>
            </Link>
            <span className="hdr-sep" />
            <span className="hdr-team">{team?.name ?? "팀 미지정"}</span>
          </div>
          <div className="hdr-right">
            {mode === "demo" && <span className="pill outline demo-badge" title="체험 모드의 데이터는 서버에 올라가지 않고 이 브라우저에만 저장됩니다">체험 모드<span className="demo-badge-more"> · 이 브라우저에만 저장</span></span>}
            {user.relation === "parent" && <span className="pill outline parent-badge" title="학부모 계정은 선수 화면을 보기만 할 수 있습니다">학부모 · 보기 전용</span>}
            <Link to="/account" className={`hdr-user${location.pathname === "/account" ? " active" : ""}`} title="내 계정" aria-current={location.pathname === "/account" ? "page" : undefined}>
              <Avatar name={user.name} tone={user.role === "coach" ? "violet" : "brand"} size="sm" />
              <div className="who">
                <b>{user.name}</b>
                <span>{roleLabel}</span>
              </div>
            </Link>
            <button className="icon-btn" title="로그아웃" aria-label="로그아웃" onClick={doLogout}>
              <Icon.LogOut />
            </button>
          </div>
        </div>
        <div className={`tabnav-wrap${more.left ? " more-left" : ""}${more.right ? " more-right" : ""}`}>
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
          {/* 넘친 탭을 넘기는 화살표 — 탭 자체는 키보드로 닿으므로 보조 수단(포커스 제외) */}
          <button type="button" className="tabnav-arrow prev" tabIndex={-1} aria-hidden="true" onClick={() => slide(-1)}><Icon.ChevronRight /></button>
          <button type="button" className="tabnav-arrow next" tabIndex={-1} aria-hidden="true" onClick={() => slide(1)}><Icon.ChevronRight /></button>
        </div>
      </header>

      <main className="main" id="main-content" tabIndex={-1}>{children}</main>
    </div>
  );
}
