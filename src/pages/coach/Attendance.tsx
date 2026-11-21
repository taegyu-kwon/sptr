import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../../lib/store";
import { ATTENDANCE_STATUSES, attendanceTone, fmtRate, fmtTime, statusLabel, summarize } from "../../lib/status";
import { addDays, fmtDate, todayISO } from "../../lib/schedule";
import { useDayPlan } from "../../lib/dayplan";
import type { AttendanceStatus } from "../../lib/types";
import { Avatar, Empty, Notice, PageHead, Section, Seg } from "../../components/ui";
import { Icon } from "../../components/icons";
import "../../styles/attendance.css";

const GRADES = [3, 2, 1];

/** 수정 모드 칸. ""는 미체크 */
type Draft = Record<string, { status: AttendanceStatus | ""; note: string }>;

/**
 * 출석 현황 — 선수가 자기 계정에서 직접 체크한 기록을 날짜별로 본다.
 * 코치는 수정 모드에서 줄마다 상태를 고칠 수 있다(코치 수정으로 저장).
 */
export default function AttendancePage() {
  const { db, user, saveAttendance } = useStore();
  const teamId = user!.teamId;
  const players = db.players.filter(p => p.teamId === teamId);
  const teamAttendance = db.attendance.filter(a => a.teamId === teamId);
  const today = todayISO();

  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [saved, setSaved] = useState<number | null>(null);
  const dayPlan = useDayPlan(teamId, date);

  const dayRecords = teamAttendance.filter(a => a.date === date);
  const recOf = (playerId: string) => dayRecords.find(a => a.playerId === playerId);
  const unchecked = players.filter(p => !recOf(p.id));
  const day = summarize(dayRecords);

  // 날짜를 바꾸면 수정 모드를 닫는다
  useEffect(() => {
    setEditing(false);
    setSaved(null);
  }, [date]);

  const openEdit = () => {
    const next: Draft = {};
    for (const p of players) {
      const r = recOf(p.id);
      next[p.id] = { status: r?.status ?? "", note: r?.note ?? "" };
    }
    setDraft(next);
    setSaved(null);
    setEditing(true);
  };

  const set = (playerId: string, patch: Partial<Draft[string]>) =>
    setDraft(d => ({ ...d, [playerId]: { ...(d[playerId] ?? { status: "", note: "" }), ...patch } }));

  /** 바뀐 줄만 코치 수정으로 저장한다 — 손대지 않은 선수 본인 체크는 그대로 남는다 */
  const save = () => {
    const changed = players.filter(p => {
      const r = recOf(p.id);
      const d = draft[p.id];
      return d && (d.status !== (r?.status ?? "") || d.note.trim() !== (r?.note ?? ""));
    });
    saveAttendance(
      teamId,
      date,
      changed.map(p => ({ playerId: p.id, status: draft[p.id].status || null, note: draft[p.id].note }))
    );
    setEditing(false);
    setSaved(changed.length);
  };

  /** 최근 날짜별 요약 — 미체크 = 그날 기록이 없는 선수 수 */
  const history = useMemo(() => {
    const byDate = new Map<string, typeof teamAttendance>();
    for (const a of teamAttendance) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12)
      .map(([d, rows]) => ({ date: d, unchecked: Math.max(0, players.length - rows.length), ...summarize(rows) }));
  }, [teamAttendance, players.length]);

  return (
    <>
      <PageHead
        title="출석"
        desc="선수가 자기 계정에서 직접 체크한 출석 현황입니다. 잘못된 기록은 수정 모드에서 고칩니다."
      />

      <div className="panel">
        <div className="flex between wrap gap12">
          <div className="att-date">
            <button type="button" className="icon-btn" aria-label="전날" onClick={() => setDate(addDays(date, -1))}>
              <Icon.ArrowLeft />
            </button>
            <input type="date" className="input" value={date} max={today} onChange={e => e.target.value && setDate(e.target.value)} />
            <button
              type="button"
              className="icon-btn"
              aria-label="다음날"
              disabled={date >= today}
              onClick={() => setDate(addDays(date, 1))}
            >
              <Icon.ChevronRight />
            </button>
            {date !== today && (
              <button type="button" className="btn ghost sm" onClick={() => setDate(today)}>오늘</button>
            )}
          </div>
          <div className="flex gap8 wrap">
            {editing ? (
              <>
                <button type="button" className="btn ghost" onClick={() => setEditing(false)}>취소</button>
                <button type="button" className="btn" onClick={save}>수정 저장</button>
              </>
            ) : (
              <button type="button" className="btn outline" onClick={openEdit}>
                <Icon.PenLine />
                출석 수정
              </button>
            )}
          </div>
        </div>
        <div className="att-day mt12">
          <b>{fmtDate(date)}</b>
          {dayPlan.length > 0 ? (
            dayPlan.map(t => <span key={t} className="pill outline">{t}</span>)
          ) : (
            <span className="small faint">등록된 일정 없음</span>
          )}
        </div>
        <div className="att-count small dim mt8">
          출석 {day.counts.출석} · 지각 {day.counts.지각} · 결석 {day.counts.결석} · 사유결석 {day.counts.사유결석} ·{" "}
          <b className={unchecked.length ? "warn-text" : ""}>미체크 {unchecked.length}</b> · 출석률 {fmtRate(day.rate)}
        </div>
        {editing && (
          <Notice kind="info" className="mt12">
            바꾼 줄만 "코치 수정"으로 저장됩니다. 상태를 비우면(다시 눌러 해제) 미체크로 돌아갑니다.
          </Notice>
        )}
        {saved !== null && <Notice kind="ok" className="mt12">{saved}명의 출석을 수정했습니다.</Notice>}
      </div>

      {!editing && unchecked.length > 0 && players.length > 0 && (
        <div className="panel att-grade">
          <div className="card-head">
            <h3>미체크</h3>
            <span className="meta">{unchecked.length}명</span>
          </div>
          <div className="att-unchecked">
            {unchecked
              .sort((a, b) => b.grade - a.grade || a.backNumber - b.backNumber)
              .map(p => {
                const st = statusLabel(p, today);
                return (
                  <span key={p.id} className="pill outline" title={st ?? undefined}>
                    {p.grade}학년 #{p.backNumber} {p.name}{st ? ` · ${p.status!.kind}` : ""}
                  </span>
                );
              })}
          </div>
        </div>
      )}

      {players.length === 0 ? (
        <div className="panel"><Empty>등록된 선수가 없습니다.</Empty></div>
      ) : (
        GRADES.map(g => {
          const rows = players.filter(p => p.grade === g).sort((a, b) => a.backNumber - b.backNumber);
          if (!rows.length) return null;
          return (
            <div className="panel att-grade" key={g}>
              <div className="card-head">
                <h3>{g}학년</h3>
                <span className="meta">
                  체크 {rows.filter(p => recOf(p.id)).length} / {rows.length}명
                </span>
              </div>
              <div className="tbl-wrap">
                <table className="tbl att-tbl">
                  <thead>
                    <tr><th>선수</th><th>상태</th>{!editing && <th>체크</th>}<th>메모</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(p => {
                      const r = recOf(p.id);
                      const d = draft[p.id];
                      const st = statusLabel(p, today);
                      return (
                        <tr key={p.id} className={!r && !editing ? "att-miss" : ""}>
                          <td>
                            <div className="who">
                              <Avatar name={p.name} size="sm" />
                              <div className="two">
                                <b>{p.name}</b>
                                <small>#{p.backNumber}{st ? ` · ${st}` : ""}</small>
                              </div>
                            </div>
                          </td>
                          {editing ? (
                            <>
                              <td>
                                <Seg
                                  small
                                  value={d?.status ?? ""}
                                  onChange={v => set(p.id, { status: d?.status === v ? "" : (v as AttendanceStatus) })}
                                  options={ATTENDANCE_STATUSES.map(s => ({ value: s, label: s }))}
                                />
                              </td>
                              <td>
                                <input
                                  className="input att-note"
                                  value={d?.note ?? ""}
                                  onChange={e => set(p.id, { note: e.target.value })}
                                  placeholder="사유·메모"
                                />
                              </td>
                            </>
                          ) : (
                            <>
                              <td>
                                {r ? (
                                  <span className={`pill ${attendanceTone(r.status)}`}>{r.status}</span>
                                ) : (
                                  <span className="pill outline">미체크</span>
                                )}
                              </td>
                              <td className="dim">
                                {r ? `${fmtTime(r.checkedAt) ?? "-"} · ${r.source === "코치" ? "코치 수정" : "본인"}` : "-"}
                              </td>
                              <td className="dim">{r?.note ?? ""}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      <Section title="최근 출석 기록" meta="날짜를 누르면 그날 현황을 엽니다">
        <div className="panel sub">
          {history.length === 0 ? (
            <Empty>아직 출석 기록이 없습니다.</Empty>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th className="num">출석</th>
                    <th className="num">지각</th>
                    <th className="num">결석</th>
                    <th className="num">사유결석</th>
                    <th className="num">미체크</th>
                    <th className="num">출석률</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.date} className={`clickable${h.date === date ? " att-on" : ""}`} onClick={() => setDate(h.date)}>
                      <td>{fmtDate(h.date)}</td>
                      <td className="num">{h.counts.출석}</td>
                      <td className="num">{h.counts.지각}</td>
                      <td className="num">{h.counts.결석}</td>
                      <td className="num">{h.counts.사유결석}</td>
                      <td className="num">{h.unchecked}</td>
                      <td className="num"><b>{fmtRate(h.rate)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small faint mt12">출석률 = (출석 + 지각) ÷ (체크한 인원 − 사유결석). 미체크는 계산에 넣지 않습니다.</p>
        </div>
      </Section>
    </>
  );
}
