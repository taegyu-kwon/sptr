import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { Icon, BrandMark } from "./icons";
import { Avatar } from "./ui";
import "../styles/server.css";

type NavItem = { to: string; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> };
type NavGroup = { label: string; items: NavItem[] };
const navigation: Record<string, NavGroup[]> = {
  coach: [
    { label: "WORKSPACE", items: [
      { to: "/c/overview", label: "팀 대시보드", icon: Icon.Gauge },
      { to: "/c/players", label: "선수단", icon: Icon.Users },
      { to: "/c/team", label: "팀 관리", icon: Icon.Shield },
    ] },
    { label: "PERFORMANCE", items: [
      { to: "/c/sbi", label: "SBI / SMI 분석", icon: Icon.TrendingUp },
      { to: "/c/ranking", label: "분야별 랭킹", icon: Icon.Trophy },
      { to: "/c/lineup", label: "경기 라인업", icon: Icon.Grid },
      { to: "/c/games", label: "시합 기록", icon: Icon.Clipboard },
      { to: "/c/centers", label: "측정 센터 지도", icon: Icon.MapPin },
    ] },
    { label: "TEAM OPERATIONS", items: [
      { to: "/c/calendar", label: "팀 캘린더", icon: Icon.Calendar },
      { to: "/c/notice", label: "훈련 공지", icon: Icon.Timer },
      { to: "/c/attendance", label: "출석 관리", icon: Icon.Check },
      { to: "/c/feedback", label: "코칭 피드백", icon: Icon.Message },
    ] },
  ],
  player: [
    { label: "MY PERFORMANCE", items: [
      { to: "/p/stats", label: "내 능력치", icon: Icon.Gauge },
      { to: "/p/growth", label: "성장 그래프", icon: Icon.TrendingUp },
      { to: "/p/input", label: "측정 기록", icon: Icon.PenLine },
      { to: "/sbi", label: "SBI / SMI 분석", icon: Icon.Calculator },
      { to: "/p/ranking", label: "팀 내 순위", icon: Icon.Trophy },
      { to: "/p/centers", label: "측정 센터 지도", icon: Icon.MapPin },
    ] },
    { label: "MY TEAM", items: [
      { to: "/p/calendar", label: "팀 캘린더", icon: Icon.Calendar },
      { to: "/p/notice", label: "훈련 공지", icon: Icon.Timer },
      { to: "/p/attendance", label: "출석 체크", icon: Icon.Check },
      { to: "/p/plan", label: "예상 라인업", icon: Icon.Grid },
      { to: "/p/feedback", label: "코칭 피드백", icon: Icon.Message },
    ] },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, db, mode } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const drawer = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    drawer.current?.close();
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1001px)");
    const close = () => { if (media.matches) drawer.current?.close(); };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  if (!user) return null;
  const team = db.teams.find(t => t.id === user.teamId);
  const groups = navigation[user.role];
  const current = groups.flatMap(g => g.items).find(item => location.pathname === item.to || location.pathname.startsWith(item.to + "/"));
  const home = user.role === "coach" ? "/c/overview" : "/p/stats";
  const calendar = user.role === "coach" ? "/c/calendar" : "/p/calendar";
  const doLogout = () => { drawer.current?.close(); logout(); navigate("/auth"); };
  const sidebar = (mobile = false) => <>
    <div className="workspace-brand"><Link to={home} aria-label="SPTR 홈"><BrandMark /><span>sptr<span className="brand-text">.</span></span></Link><span className="brand-edition">CLUBHOUSE</span>{mobile && <button className="icon-btn" aria-label="메뉴 닫기" onClick={() => drawer.current?.close()}><Icon.X /></button>}</div>
    <div className="club-identity"><div className="club-monogram">{team?.name.slice(0, 1) ?? "S"}</div><div><b>{team?.name ?? "팀 미지정"}</b><span>BASEBALL CLUB · {new Date().getFullYear()}</span></div></div>
    <nav className="workspace-nav" aria-label="주 메뉴">{groups.map(group => <div className="nav-group" key={group.label}><span className="nav-group-label">{group.label}</span>{group.items.map(item => {
      const Ic = item.icon;
      return <NavLink key={item.to} to={item.to} onClick={() => mobile && drawer.current?.close()}><Ic /><span>{item.label}</span>{item.to === "/c/players" && <small>{db.players.filter(p => p.teamId === user.teamId).length}</small>}</NavLink>;
    })}</div>)}</nav>
    <div className="sidebar-bottom"><div className="sidebar-note"><span className="eyebrow">ONE TEAM. NEXT LEVEL.</span><p>기록이 모여<br />우리 팀의 내일이 됩니다.</p><span className="sidebar-line" /></div><div className="sidebar-account"><Link to="/account" className="sidebar-account-link" title="내 계정" onClick={() => mobile && drawer.current?.close()}><Avatar name={user.name} /><div><b>{user.name}</b><span>{user.role === "coach" ? "코칭스태프" : user.relation === "parent" ? `${db.players.find(p => p.id === user.playerId)?.name ?? ""} 선수 학부모` : "선수"}</span></div></Link><button className="icon-btn" aria-label="로그아웃" title="로그아웃" onClick={doLogout}><Icon.LogOut /></button></div></div>
  </>;
  return <div className="app clubhouse">
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById("main-content")?.focus(); }}>본문으로 건너뛰기</a>
    <aside className="workspace-sidebar">{sidebar()}</aside>
    <dialog ref={drawer} className="mobile-drawer" aria-label="전체 메뉴" onClose={() => { setMenuOpen(false); menuButton.current?.focus(); }} onClick={e => { if (e.target === drawer.current) drawer.current.close(); }}><div className="mobile-drawer-inner">{sidebar(true)}</div></dialog>
    <div className="workspace-content">
      <header className="workspace-topbar"><div className="workspace-breadcrumb"><button ref={menuButton} className="icon-btn mobile-menu" aria-label="전체 메뉴 열기" aria-expanded={menuOpen} onClick={() => { drawer.current?.showModal(); setMenuOpen(true); }}><Icon.Menu /></button><span>워크스페이스</span><Icon.ChevronRight /><b>{current?.label ?? (location.pathname === "/account" ? "내 계정" : "팀 관리")}</b></div><div className="workspace-top-actions">{mode === "demo" && <span className="pill outline demo-badge" title="체험 모드의 데이터는 서버에 올라가지 않고 이 브라우저에만 저장됩니다">체험 모드<span className="demo-badge-more"> · 이 브라우저에만 저장</span></span>}{user.relation === "parent" && <span className="pill outline parent-badge" title="학부모 계정은 선수 화면을 보기만 할 수 있습니다">학부모 · 보기 전용</span>}<span className="workspace-date">{new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date())}</span><Link to={calendar} className="top-calendar"><Icon.Calendar /><span>일정 보기</span></Link></div></header>
      <main className="main" id="main-content" tabIndex={-1}>{children}</main>
      <footer className="app-footer"><span>SPTR CLUBHOUSE</span><span>EVERY PLAYER. EVERY POSSIBILITY.</span></footer>
    </div>
  </div>;
}
