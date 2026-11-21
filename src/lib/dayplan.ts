/* 그날 일정 제목 — 훈련 공지·월간 일정 경기·예전 일정(events). 출석 화면(선수·코치)이 함께 쓴다 */
import { useMemo } from "react";
import { useStore } from "./store";
import { useSchedule } from "./schedule";

export function useDayPlan(teamId: string, date: string): string[] {
  const { db } = useStore();
  const { notices, games } = useSchedule(teamId);
  return useMemo(() => {
    const out: string[] = [];
    const n = notices.find(x => x.date === date);
    if (n) out.push(n.off ? "휴식일" : `훈련 ${n.meetTime ? n.meetTime + " 집합" : ""}${n.items[0] ? ` · ${n.items.map(i => i.title).join(", ")}` : ""}`.trim());
    for (const g of games.filter(x => x.date === date)) out.push(`${g.kind} vs ${g.opponent} ${g.time}`);
    for (const e of db.events.filter(x => x.teamId === teamId && x.date === date)) out.push(`${e.type} · ${e.title}`);
    return out;
  }, [notices, games, db.events, teamId, date]);
}
