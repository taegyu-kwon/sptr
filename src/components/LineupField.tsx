import React from "react";
import type { LineupPos, Player, SavedLineup } from "../lib/types";
import { POS_SHORT, pitcherOf } from "../lib/lineup";

/** 수비 위치 좌표(%) — 홈플레이트가 아래 */
const SPOT: Record<Exclude<LineupPos, "지명타자">, [number, number]> = {
  중견수: [50, 13], 좌익수: [17, 25], 우익수: [83, 25],
  유격수: [36, 44], "2루수": [64, 44], "3루수": [22, 60], "1루수": [78, 60],
  투수: [50, 62], 포수: [50, 89],
};

/** 다이아몬드 위에 수비 위치별 선수 + 타순 번호를 그린다 */
export default function LineupField({
  lineup, players, meId,
}: { lineup: Pick<SavedLineup, "useDH" | "order" | "pitcherId">; players: Player[]; meId?: string | null }) {
  const byId = (id?: string | null) => (id ? players.find(p => p.id === id) : undefined);
  const spId = pitcherOf(lineup);
  const at = (pos: LineupPos) => {
    if (pos === "투수") {
      const p = byId(spId);
      const i = lineup.order.findIndex(b => b?.playerId === spId);
      return p ? { p, order: i >= 0 ? i + 1 : null } : null;
    }
    const i = lineup.order.findIndex(b => b?.pos === pos);
    const p = i >= 0 ? byId(lineup.order[i]!.playerId) : undefined;
    return p ? { p, order: i + 1 } : null;
  };
  const dh = lineup.useDH ? at("지명타자") : null;

  return (
    <div className="lu-field" role="img" aria-label="수비 위치 배치도">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M50 96 L2 46 Q50 -8 98 46 Z" className="grass" />
        <path d="M50 92 L73 66 L50 42 L27 66 Z" className="dirt" />
        <path d="M50 92 L2 46 M50 92 L98 46" className="foul" />
        <circle cx="50" cy="65" r="3.2" className="mound" />
      </svg>
      {(Object.keys(SPOT) as (keyof typeof SPOT)[]).map(pos => {
        const s = at(pos);
        const [x, y] = SPOT[pos];
        return (
          <div key={pos} className={`lu-spot${s ? "" : " empty"}${s && s.p.id === meId ? " me" : ""}`} style={{ left: `${x}%`, top: `${y}%` }}>
            <span className="pos">{POS_SHORT[pos]}</span>
            <span className="nm">
              {s?.order && <i>{s.order}</i>}
              {s ? s.p.name : "—"}
            </span>
          </div>
        );
      })}
      {lineup.useDH && (
        <div className={`lu-spot dh${dh ? "" : " empty"}${dh && dh.p.id === meId ? " me" : ""}`}>
          <span className="pos">지명</span>
          <span className="nm">
            {dh?.order && <i>{dh.order}</i>}
            {dh ? dh.p.name : "—"}
          </span>
        </div>
      )}
    </div>
  );
}
