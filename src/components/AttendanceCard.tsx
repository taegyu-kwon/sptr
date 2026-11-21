import React from "react";
import type { AttendanceRecord } from "../lib/types";
import { attendanceTone, fmtRate, fmtTime, summarize } from "../lib/status";
import { fmtDate } from "../lib/schedule";
import { Cell, Cells } from "./ui";

/** 선수 한 명의 출석 요약 + 최근 기록. 선수 상세(코치)와 선수 출석 화면이 함께 쓴다 */
export default function AttendanceCard({ records, empty }: { records: AttendanceRecord[]; empty: string }) {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const att = summarize(sorted);
  return (
    <div className="panel sub">
      <Cells n={5}>
        <Cell label="출석률" value={fmtRate(att.rate)} sub={`기록 ${att.total}일 · 사유결석 제외`} />
        <Cell label="출석" value={att.counts.출석} unit="회" />
        <Cell label="지각" value={att.counts.지각} unit="회" />
        <Cell label="결석" value={att.counts.결석} unit="회" />
        <Cell label="사유결석" value={att.counts.사유결석} unit="회" />
      </Cells>
      {sorted.length > 0 ? (
        <div className="tbl-wrap mt16">
          <table className="tbl">
            <thead>
              <tr><th>날짜</th><th>상태</th><th>체크</th><th>메모</th></tr>
            </thead>
            <tbody>
              {sorted.slice(0, 10).map(a => (
                <tr key={a.id}>
                  <td>{fmtDate(a.date)}</td>
                  <td><span className={`pill ${attendanceTone(a.status)}`}>{a.status}</span></td>
                  <td className="dim">
                    {a.status === "결석" || a.status === "사유결석" ? "-" : fmtTime(a.checkedAt) ?? "-"}
                    {a.source === "코치" ? " · 코치 수정" : ""}
                  </td>
                  <td className="dim">{a.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="small faint mt12">{empty}</p>
      )}
    </div>
  );
}
