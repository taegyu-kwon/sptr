import React, { useMemo, useState } from "react";
import { useStore } from "../../lib/store";
import { evaluatePlayer } from "../../lib/gpe";
import { LINEUP_SLOTS, currentLineup, defaultLineup, lineupStrength } from "../../lib/lineup";
import { Avatar, Cell, Cells, Empty, Meter, Notice, PageHead, ScoreBar, ScoreRing, Section } from "../../components/ui";
import "../../styles/coach.css";

export default function LineupPage() {
  const { db, user, setDB } = useStore();
  const teamId = user!.teamId;
  const players = db.players.filter(p => p.teamId === teamId);

  const [slots, setSlots] = useState<Record<string, string>>(() => currentLineup(db, teamId));
  const [savedMsg, setSavedMsg] = useState(false);

  const strength = useMemo(() => lineupStrength(db, slots), [db, slots]);

  const usedIds = new Set(Object.values(slots).filter(Boolean));

  const setSlot = (slot: string, playerId: string) => {
    setSlots(prev => {
      const next = { ...prev };
      // 같은 선수가 다른 슬롯에 있으면 제거 (중복 방지)
      for (const k of Object.keys(next)) {
        if (next[k] === playerId && k !== slot) delete next[k];
      }
      if (playerId) next[slot] = playerId;
      else delete next[slot];
      return next;
    });
  };

  const save = () => {
    setDB(prev => ({
      ...prev,
      lineups: [
        ...prev.lineups.filter(l => l.teamId !== teamId),
        { teamId, updatedAt: new Date().toISOString(), slots },
      ],
    }));
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  const placedSlots = LINEUP_SLOTS.filter(s => slots[s]);

  return (
    <>
      <PageHead
        title="라인업 시뮬레이션"
        desc="슬롯별로 선수를 배치하면 라인업 전력이 즉시 계산됩니다. 저장하면 선수단의 팀 플랜 페이지에 예상 라인업으로 공개됩니다."
        actions={
          <>
            <button type="button" className="btn outline sm" onClick={() => setSlots(defaultLineup(players))}>
              추천 자동 배치
            </button>
            <button type="button" className="btn sm" onClick={save}>라인업 저장</button>
          </>
        }
      />

      <div className="panel hero">
        <div className="flex gap24 wrap start">
          <ScoreRing value={strength.avg} size={132} label="전력" />
          <div className="hero-stats">
            <Cells n={2}>
              <Cell label="공격 지수" value={strength.attack} size="md" meter={strength.attack} sub="실전 60% + 운동능력 40%" />
              <Cell label="수비 지수" value={strength.defense} size="md" meter={strength.defense} sub="선발투수 50% + 야수진 수비 50%" />
            </Cells>
          </div>
        </div>
      </div>

      {savedMsg && (
        <Notice kind="ok" className="mt12">저장되었습니다. 선수/학부모 팀 플랜 페이지에 반영됩니다.</Notice>
      )}

      <Section title="슬롯 배치" meta={`배치 ${placedSlots.length} / ${LINEUP_SLOTS.length}`}>
        <div className="lineup-grid">
          {LINEUP_SLOTS.map(slot => {
            const selected = slots[slot] ?? "";
            const pool = slot === "선발투수" ? players.filter(p => p.position === "투수") : players;
            const placed = selected ? players.find(p => p.id === selected) : undefined;
            const placedScore = placed ? evaluatePlayer(placed).total : 0;
            return (
              <div className={`lineup-slot${placed ? " filled" : ""}`} key={slot}>
                <div className="slot-name">{slot}</div>
                {placed ? (
                  <>
                    <div className="slot-who">
                      <Avatar name={placed.name} size="sm" />
                      <b>{placed.name}</b>
                      <span>{placed.position}</span>
                    </div>
                    <div className="slot-score">
                      {placedScore}
                      <Meter value={placedScore} size="sm" />
                    </div>
                  </>
                ) : (
                  <div className="slot-who none">미배치</div>
                )}
                <select value={selected} onChange={e => setSlot(slot, e.target.value)} aria-label={`${slot} 선수 선택`}>
                  <option value="">— 미배치 —</option>
                  {pool.map(p => {
                    const r = evaluatePlayer(p);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.position} · {r.total}점{usedIds.has(p.id) && p.id !== selected ? " (배치됨)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="배치 선수 전력">
        <div className="panel">
          {placedSlots.length === 0 ? (
            <Empty>배치된 선수가 없습니다. 슬롯에 선수를 배치하면 전력이 표시됩니다.</Empty>
          ) : (
            placedSlots.map(slot => {
              const p = players.find(x => x.id === slots[slot]);
              if (!p) return null;
              const r = evaluatePlayer(p);
              return <ScoreBar key={slot} label={`${slot} — ${p.name}`} score={r.total} comment={`${p.position}, ${p.grade}학년`} />;
            })
          )}
        </div>
      </Section>
    </>
  );
}
