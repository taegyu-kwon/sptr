import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../../lib/store";
import { latest } from "../../lib/gpe";
import PlayerReport from "../../components/PlayerReport";
import { fmtDate } from "../../lib/format";
import { Cell, Cells, PageHead, Section } from "../../components/ui";
import { Icon } from "../../components/icons";

const signed = (v: number) => `${v >= 0 ? "+" : ""}${v}`;

export default function PlayerDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db } = useStore();
  const player = db.players.find(p => p.id === id);

  if (!player) {
    return (
      <PageHead
        title="선수를 찾을 수 없습니다"
        actions={<button type="button" className="btn secondary" onClick={() => nav("/c/players")}>목록으로</button>}
      />
    );
  }

  const s = latest(player);
  const injury = s.body.injuryHistory.trim();

  const header = (
    <div className="flex between wrap gap16">
      <div className="profile">
        <div className="profile-num">{player.backNumber}</div>
        <div>
          <div className="profile-name">{player.name}</div>
          <div className="profile-meta">
            <span>{player.position}</span>
            <span className="sep" />
            <span>{player.grade}학년</span>
            <span className="sep" />
            <span>측정 {player.records.length}회</span>
            <span className="sep" />
            <span>최근 {fmtDate(s.date)}</span>
          </div>
        </div>
      </div>
      <button type="button" className="btn ghost sm" onClick={() => nav("/c/players")}>
        <Icon.ArrowLeft />
        선수 목록
      </button>
    </div>
  );

  const after = (
    <Section title="신체·실전 요약">
      <div className="panel sub">
        <Cells n={4}>
          <Cell
            label="신장 / 체중"
            size="md"
            value={<>{s.body.height}<span className="unit">cm</span> / {s.body.weight}<span className="unit">kg</span></>}
            sub={`골격근 ${s.body.skeletalMuscle}kg · 체지방 ${s.body.bodyFat}% · 윙스팬 ${s.body.wingspan}cm`}
          />
          <Cell
            label="최근 1년 성장"
            size="md"
            value={<>{signed(s.body.heightChange1y)}<span className="unit">cm</span> / {signed(s.body.weightChange1y)}<span className="unit">kg</span></>}
            sub={`관절 가동범위 ${s.body.jointROM}/100`}
          />
          <Cell
            label={s.practical.kind === "투수" ? "최고 구속" : "송구 속도"}
            size="md"
            value={s.practical.maxVelo}
            unit="km/h"
            sub={`멀리던지기 ${s.practical.longThrow}m · 커맨드 ${s.practical.command}`}
          />
          <Cell
            label="부상/통증 이력"
            size="sm"
            value={injury || "없음"}
            sub={`에러율 ${s.practical.errorRate}%`}
          />
        </Cells>
      </div>
    </Section>
  );

  return <PlayerReport player={player} header={header} after={after} />;
}
