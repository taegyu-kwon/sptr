import React, { useMemo, useState } from "react";
import { useStore } from "../../lib/store";
import { evaluatePlayer } from "../../lib/gpe";
import { LINEUP_SLOTS, currentLineup, defaultLineup, lineupStrength } from "../../lib/lineup";
import { ScoreBar } from "../../components/ui";

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

  return (
    <>
      <h1 className="page-title">라인업 시뮬레이션</h1>
      <p className="page-desc">
        슬롯별로 선수를 배치하면 라인업 전력이 즉시 계산됩니다. 저장하면 선수단의 팀 플랜 페이지에 예상 라인업으로 공개됩니다.
      </p>

      <div className="grid cols-3">
        <div className="card stat">
          <span className="label">라인업 종합 전력</span>
          <span className="value">{strength.avg}</span>
          <span className="hint">배치된 선수 종합 점수 평균</span>
        </div>
        <div className="card stat">
          <span className="label">공격 지수</span>
          <span className="value">{strength.attack}</span>
          <span className="hint">실전 60% + 운동능력 40%</span>
        </div>
        <div className="card stat">
          <span className="label">수비 지수</span>
          <span className="value">{strength.defense}</span>
          <span className="hint">선발투수 50% + 야수진 수비 50%</span>
        </div>
      </div>

      <div className="card mt16">
        <div className="flex between wrap">
          <h3 style={{ margin: 0 }}>슬롯 배치</h3>
          <div className="flex" style={{ gap: 8 }}>
            <button className="btn ghost sm" onClick={() => setSlots(defaultLineup(players))}>
              추천 라인업 자동 배치
            </button>
            <button className="btn sm" onClick={save}>라인업 저장 (팀에 공개)</button>
          </div>
        </div>
        {savedMsg && <div className="ok-box mt8">저장되었습니다. 선수/학부모 팀 플랜 페이지에 반영됩니다.</div>}
        <div className="lineup-grid mt16">
          {LINEUP_SLOTS.map(slot => {
            const selected = slots[slot] ?? "";
            const pool = slot === "선발투수" ? players.filter(p => p.position === "투수") : players;
            return (
              <div className="lineup-slot" key={slot}>
                <div className="slot-name">{slot}</div>
                <select value={selected} onChange={e => setSlot(slot, e.target.value)}>
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
      </div>

      <div className="card mt16">
        <h3>배치 선수 전력 상세</h3>
        {LINEUP_SLOTS.filter(s => slots[s]).map(slot => {
          const p = players.find(x => x.id === slots[slot]);
          if (!p) return null;
          const r = evaluatePlayer(p);
          return <ScoreBar key={slot} label={`${slot} — ${p.name}`} score={r.total} comment={`${p.position}, ${p.grade}학년`} />;
        })}
      </div>
    </>
  );
}
