import React, { useState } from "react";
import { useStore } from "../../lib/store";
import { fmtTime, statusLabel } from "../../lib/status";
import { fmtDate, todayISO } from "../../lib/schedule";
import { useDayPlan } from "../../lib/dayplan";
import type { AttendanceStatus } from "../../lib/types";
import AttendanceCard from "../../components/AttendanceCard";
import { Notice, PageHead, Section } from "../../components/ui";
import { Icon } from "../../components/icons";
import "../../styles/attendance.css";

/** 선수 본인 출석 체크 — 오늘만, 하루 한 번(다시 하면 덮어씀) */
export default function PlayerAttendancePage() {
  const { db, user, checkIn } = useStore();
  const player = db.players.find(p => p.id === user?.playerId);
  const today = todayISO();
  const dayPlan = useDayPlan(user!.teamId, today);

  /** 신고 폼: 늦어요 → 지각, 못 가요 → 결석/사유결석 */
  const [report, setReport] = useState<"late" | "absent" | null>(null);
  const [absentKind, setAbsentKind] = useState<AttendanceStatus>("사유결석");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!player) return <PageHead title="출석" desc="연결된 선수 정보가 없습니다." />;

  const mine = db.attendance.filter(a => a.playerId === player.id);
  const todayRec = mine.find(a => a.date === today);
  const year = today.slice(0, 4);
  const injured = player.status?.kind === "재활" || player.status?.kind === "부상";
  const st = statusLabel(player, today);

  const doCheck = (status: AttendanceStatus, n?: string) => {
    const err = checkIn(player.id, player.teamId, today, status, n);
    setError(err);
    if (!err) {
      setReport(null);
      setNote("");
    }
  };

  const openReport = (kind: "late" | "absent") => {
    setReport(kind);
    setError(null);
    setAbsentKind("사유결석");
    setNote(kind === "absent" && injured ? player.status!.note ?? player.status!.kind : "");
  };

  const submitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return setError("사유를 적어 주세요.");
    doCheck(report === "late" ? "지각" : absentKind, note);
  };

  return (
    <>
      <PageHead title="출석" desc="훈련에 오면 오늘 출석을 직접 체크합니다. 늦거나 못 오면 미리 알려 주세요." />

      <div className="panel">
        <div className="att-day">
          <b>오늘 {fmtDate(today)}</b>
          {dayPlan.length > 0 ? (
            dayPlan.map(t => <span key={t} className="pill outline">{t}</span>)
          ) : (
            <span className="small faint">오늘 일정 없음</span>
          )}
        </div>
        {st && <div className="mt8"><span className="pill warn">{st}</span></div>}

        <div className="att-check">
          {todayRec ? (
            <>
              <div className="att-done">
                <Icon.Check />
                {todayRec.status === "출석" ? "체크 완료" : `${todayRec.status} 신고 완료`}
                {fmtTime(todayRec.checkedAt) ? ` · ${fmtTime(todayRec.checkedAt)}` : ""}
              </div>
              {todayRec.note && <span className="small dim">사유: {todayRec.note}</span>}
              {todayRec.source === "코치" && <span className="small faint">코치가 수정한 기록입니다.</span>}
              {(todayRec.status === "결석" || todayRec.status === "사유결석") && (
                <button type="button" className="btn outline sm" onClick={() => doCheck("출석")}>
                  올 수 있게 됐어요 — 출석 체크
                </button>
              )}
            </>
          ) : (
            <button type="button" className="btn att-big" onClick={() => doCheck("출석")}>
              <Icon.Check />
              출석 체크
            </button>
          )}

          {!report && !todayRec && (
            <div className="flex gap8 wrap">
              <button type="button" className="btn ghost sm" onClick={() => openReport("late")}>늦어요</button>
              <button type="button" className="btn ghost sm" onClick={() => openReport("absent")}>못 가요</button>
            </div>
          )}

          {report && (
            <form className="att-report" onSubmit={submitReport}>
              <div className="form-grid">
                {report === "absent" && (
                  <div className="field">
                    <label>구분</label>
                    <select value={absentKind} onChange={e => setAbsentKind(e.target.value as AttendanceStatus)}>
                      <option value="사유결석">사유결석 (병원·학교 행사·재활 등)</option>
                      <option value="결석">결석</option>
                    </select>
                  </div>
                )}
                <div className="field span-all">
                  <label>{report === "late" ? "늦는 이유" : "못 오는 이유"}</label>
                  <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder={report === "late" ? "예: 보충수업 끝나고 16:30 도착" : "예: 병원 진료"}
                  />
                </div>
              </div>
              <div className="flex gap8 wrap mt12">
                <button className="btn" type="submit">{report === "late" ? "지각 신고" : "결석 신고"}</button>
                <button className="btn ghost" type="button" onClick={() => setReport(null)}>취소</button>
              </div>
            </form>
          )}
          {error && <Notice kind="error">{error}</Notice>}
        </div>
      </div>

      <Section title="내 출석" meta={`${year}년`}>
        <AttendanceCard records={mine.filter(a => a.date.startsWith(year))} empty="올해 출석 기록이 없습니다." />
      </Section>
    </>
  );
}
