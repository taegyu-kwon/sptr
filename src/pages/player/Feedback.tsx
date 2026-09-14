import React from "react";
import { useStore } from "../../lib/store";
import { fmtDate } from "../../lib/format";
import { PageHead, Avatar, Empty } from "../../components/ui";
import type { FeedbackItem } from "../../lib/types";

function FeedList({ items, tone }: { items: FeedbackItem[]; tone: "brand" | "violet" }) {
  return (
    <div className="feed">
      {items.map(f => (
        <div className="feed-item" key={f.id}>
          <Avatar name={f.author} tone={tone} />
          <div>
            <div className="feed-meta">
              <b>{f.author}</b>
              <span className={`pill${tone === "violet" ? " violet" : ""}`}>{f.category}</span>
              <span className="date">{fmtDate(f.date)}</span>
            </div>
            <div className="feed-body">{f.content}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FeedbackPage() {
  const { db, user } = useStore();
  const mine = db.feedbacks
    .filter(f => f.teamId === user?.teamId && f.playerId === user?.playerId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const team = db.feedbacks
    .filter(f => f.teamId === user?.teamId && f.playerId === null)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHead title="코칭스태프 피드백" desc="코칭스태프가 남긴 개인 피드백과 팀 전체 피드백입니다." />

      <div className="grid cols-2">
        <div className="card">
          <h3>개인 피드백</h3>
          {mine.length === 0 ? <Empty>아직 등록된 개인 피드백이 없습니다.</Empty> : <FeedList items={mine} tone="brand" />}
        </div>
        <div className="card">
          <h3>팀 전체 피드백</h3>
          {team.length === 0 ? <Empty>아직 등록된 팀 피드백이 없습니다.</Empty> : <FeedList items={team} tone="violet" />}
        </div>
      </div>
    </>
  );
}
