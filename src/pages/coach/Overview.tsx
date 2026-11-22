import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../lib/store";
import { addDays, dday, fmtDate, fromISO, monthOf, todayISO, useSchedule, weekStart, WEEKDAYS } from "../../lib/schedule";
import { evaluatePlayer } from "../../lib/gpe";
import { gamesInYear } from "../../lib/stats";
import { statusLabel } from "../../lib/status";
import { playerPositionDetail } from "../../lib/roster";
import { Icon } from "../../components/icons";
import "../../styles/overview.css";

export default function OverviewPage() {
  const { db, user } = useStore();
  const teamId = user!.teamId;
  const team = db.teams.find(t => t.id === teamId);
  const players = db.players.filter(p => p.teamId === teamId);
  const today = todayISO();
  const [selected, setSelected] = useState(today);
  const { games, notices, directions } = useSchedule(teamId);
  const nextGame = games.find(g => g.date >= today);
  const training = notices.find(n => n.date === selected);
  const dayGames = games.filter(g => g.date === selected);
  const seasonGames = gamesInYear(db.games.filter(g => g.teamId === teamId), new Date().getFullYear());
  const wins = seasonGames.filter(g => g.result === "승").length;
  const losses = seasonGames.filter(g => g.result === "패").length;
  const draws = seasonGames.filter(g => g.result === "무").length;
  const attendance = db.attendance.filter(a => a.teamId === teamId && a.date === today);
  const attended = attendance.filter(a => a.status === "출석" || a.status === "지각").length;
  // 일요일·휴식 공지 날처럼 훈련이 없고 체크도 없는 날은 0/24 대신 "훈련 없는 날"로 보여 준다
  const todayNotice = notices.find(n => n.date === today);
  const restDay = attendance.length === 0 && (todayNotice ? todayNotice.off : !games.some(g => g.date === today));
  const care = players.filter(p => p.status?.kind === "부상" || p.status?.kind === "재활");
  const avg = players.length ? Math.round(players.reduce((sum, p) => sum + evaluatePlayer(p).total, 0) / players.length) : null;
  const focus = directions.find(d => d.month === monthOf(today));
  const focusDone = focus?.items.filter(i => i.done).length ?? 0;
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart(today), i));
  const featured = [...players].sort((a,b) => evaluatePlayer(b).total - evaluatePlayer(a).total).slice(0, 3);
  const seasonMeter = seasonGames.length ? Math.round(wins / seasonGames.length * 10) : 0;
  return <div className="overview-page">
    <div className="page-head">
      <div><h1 className="page-title">우리 팀의 오늘<span className="brand-text">.</span></h1><p className="page-desc">{user!.name}님, 다음 이닝을 함께 준비해 볼까요?</p></div>
      <div className="actions"><Link className="btn outline" to="/c/calendar"><Icon.Calendar /> 팀 일정 보기</Link></div>
    </div>
    <div className="overview-top-grid">
      <section className="panel tint next-game">
        <span className="eyebrow brand">NEXT GAME</span>
        {nextGame ? <>
          <div className="watermark" aria-hidden="true">{dday(today, nextGame.date)}</div>
          <div className="display brand next-dday">{dday(today, nextGame.date)}</div>
          <div className="next-opponent">vs. {nextGame.opponent}</div>
          <p className="next-meta">{nextGame.kind} · {fmtDate(nextGame.date)} {nextGame.time}</p>
          <Link to={nextGame.kind === "정식대회" ? `/c/lineup?game=${nextGame.id}` : `/c/calendar?m=${monthOf(nextGame.date)}`} className="btn next-link">{nextGame.kind === "정식대회" ? "라인업 준비하기" : "경기 일정 보기"} <Icon.ChevronRight /></Link>
        </> : <>
          <div className="display next-dday dim">—</div>
          <p className="next-meta">다가오는 경기가 아직 등록되지 않았어요.</p>
          <Link to="/c/calendar" className="btn next-link">경기 일정 확인하기 <Icon.ChevronRight /></Link>
        </>}
      </section>
      <section className="panel season-card">
        <div className="section-top"><span className="eyebrow">SEASON RECORD</span><Link to="/c/games" className="text-action">경기 기록 <Icon.ChevronRight /></Link></div>
        <div className="season-record-number"><b>{wins}</b><span>승</span><i>/</i><b>{losses}</b><span>패</span><small>{draws}무</small></div>
        <div className="meter lg brand" role="img" aria-label={`${seasonGames.length}경기 중 ${wins}승`}>{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < seasonMeter ? "on" : ""} />)}</div>
        <div className="season-record-bottom">총 {seasonGames.length}경기 · 이번 시즌</div>
      </section>
    </div>
    <div className="panel overview-metrics">
      <Link to="/c/players" className="cell"><span className="label"><Icon.Users /> 함께하는 선수</span><span className="value">{players.length}<span className="unit">명</span></span></Link>
      <Link to="/c/ranking" className="cell"><span className="label"><Icon.TrendingUp /> 팀 평균 종합 점수</span><span className="value">{avg ?? "—"}<span className="unit">점</span></span></Link>
      <Link to="/c/attendance" className="cell"><span className="label"><Icon.Check /> 오늘 출석 · 지각</span>{restDay ? <span className="value">—<span className="unit">훈련 없는 날</span></span> : <span className="value">{attended}<span className="unit">/ {players.length}명</span></span>}</Link>
      <Link to="/c/players" className="cell"><span className="label"><Icon.Shield /> 재활 · 부상 선수</span><span className="value">{care.length}<span className="unit">명</span></span></Link>
    </div>
    <div className="overview-body-grid">
      <section className="panel schedule-preview">
        <div className="card-head"><div><span className="eyebrow">DAILY ROUTINE</span><h3>이번 주, 함께할 시간</h3></div><Link to={`/c/notice?date=${selected}`} className="text-action">훈련 공지 <Icon.ChevronRight /></Link></div>
        <div className="week-picker" role="group" aria-label="훈련 날짜 선택">{days.map(date => <button type="button" key={date} aria-pressed={selected === date} onClick={() => setSelected(date)} className={`${selected === date ? "selected" : ""} ${today === date ? "today" : ""}`}><span>{WEEKDAYS[fromISO(date).getDay()]}</span><b>{fromISO(date).getDate()}</b><i className={notices.some(n => n.date === date) || games.some(g => g.date === date) ? "has-event" : ""} /></button>)}</div>
        <div className="day-preview" aria-live="polite">
          <div className="day-preview-label"><b>{fmtDate(selected)}</b><span>{training?.off ? "휴식일" : training?.meetTime ? `${training.meetTime} 집합` : "팀 스케줄"}</span></div>
          {dayGames.map(game => <Link className="timeline-game" key={game.id} to={`/c/calendar?m=${monthOf(selected)}`}><Icon.Trophy /><div><b>{game.kind} vs {game.opponent}</b><span>{[game.time, game.place].filter(Boolean).join(" · ")}</span></div><Icon.ChevronRight /></Link>)}
          {training && !training.off && training.items.length > 0 ? <div className="training-timeline">{training.items.slice(0, 3).map(item => <div className="timeline-row" key={item.id}><time>{item.start}</time><i /><div><b>{item.title}</b><span>{item.group} · {item.place || training.place || "장소 미정"}</span></div></div>)}{training.items.length > 3 && <Link className="timeline-more" to={`/c/notice?date=${selected}`}>훈련 공지에서 전체 일정 보기 <Icon.ChevronRight /></Link>}</div> : <div className="schedule-empty"><Icon.Calendar /><b>{training?.off ? "충분히 쉬고, 더 좋은 컨디션으로." : dayGames.length ? "등록된 훈련 공지가 없습니다." : "아직 등록된 일정이 없어요."}</b><p>{training?.off ? training.message : "새로운 일정은 팀 캘린더에서 확인할 수 있어요."}</p></div>}
        </div>
      </section>
      <div className="overview-side-stack">
        <section className="panel focus-card">
          <div className="section-top"><span className="eyebrow">MONTHLY FOCUS</span><span className="pill">{Number(today.slice(5,7))}월</span></div>
          <h3>{focus?.theme ?? "이번 달의 목표를 세워보세요."}</h3>
          <div className="focus-tasks">{focus?.items.slice(0, 3).map(item => <div key={item.id} className={item.done ? "done" : ""}><span>{item.done ? <Icon.Check /> : <i />}</span><p>{item.text}</p></div>)}</div>
          <Link to="/c/calendar" className="focus-bottom"><span>{focus ? `${focusDone} / ${focus.items.length} 목표 완료` : "팀 훈련 방향 설정"}</span><Icon.ChevronRight /></Link>
        </section>
        <section className="panel care-card">
          <div className="section-top"><h3>컨디션 체크</h3>{care.length > 0 && <span className="pill warn"><span className="dot" />{care.length}명</span>}</div>
          {care.length ? care.slice(0,2).map(p => <Link key={p.id} to={`/c/players/${p.id}`} className="care-player"><span className="care-number">{p.backNumber}</span><div><b>{p.name}</b><span>{statusLabel(p,today)}</span></div><Icon.ChevronRight /></Link>) : <p className="muted small">현재 재활·부상으로 등록된 선수가 없습니다.</p>}
        </section>
      </div>
    </div>
    <section className="section featured-section">
      <div className="section-head"><div><span className="eyebrow">PLAYER SPOTLIGHT</span><h2 className="section-title">우리 팀의 주목할 선수</h2></div><Link to="/c/players" className="text-action">선수단 전체 보기 <Icon.ChevronRight /></Link></div>
      <div className="featured-grid">{featured.map((p,i) => <Link className="panel featured-player" key={p.id} to={`/c/players/${p.id}`}><span className={`row-num${i === 0 ? " top" : ""}`}>{String(i + 1).padStart(2, "0")}</span><div className="grow"><span>{playerPositionDetail(p)} · {p.grade}학년 · #{p.backNumber}</span><h3>{p.name}</h3></div><div className="featured-score"><b>{evaluatePlayer(p).total}</b><span>종합 점수</span></div><Icon.ChevronRight /></Link>)}</div>
      <p className="spotlight-note">최근 측정의 종합 점수 기준 · {team?.name}</p>
    </section>
  </div>;
}
