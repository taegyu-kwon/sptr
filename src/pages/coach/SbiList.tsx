import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../lib/store";
import { evaluatePlayerSbi, r1 } from "../../lib/sbi";
import { Avatar, Cell, Cells, Empty, Medal, PageHead, Seg } from "../../components/ui";
import "../../styles/coach.css";

type SortKey = "finalR" | "sbi" | "smi" | "name";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "finalR", label: "최종 R 순" },
  { value: "sbi", label: "SBI 순" },
  { value: "smi", label: "SMI 순" },
  { value: "name", label: "이름 순" },
];

export default function CoachSbiListPage() {
  const { db, user } = useStore();
  const nav = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("finalR");

  const rows = useMemo(() => {
    const list = db.players
      .filter(p => p.teamId === user?.teamId)
      .map(p => ({ p, idx: evaluatePlayerSbi(p) }));
    return list.sort((a, b) => {
      if (sortKey === "name") return a.p.name.localeCompare(b.p.name, "ko");
      const av = a.idx ? a.idx[sortKey] : -1;
      const bv = b.idx ? b.idx[sortKey] : -1;
      return bv - av;
    });
  }, [db.players, user?.teamId, sortKey]);

  const measured = rows.filter(x => x.idx !== null);
  const avgR = measured.length ? measured.reduce((s, x) => s + (x.idx?.finalR ?? 0), 0) / measured.length : 0;
  const best = measured.reduce<(typeof measured)[number] | null>(
    (top, x) => (!top || (x.idx?.finalR ?? -1) > (top.idx?.finalR ?? -1) ? x : top),
    null
  );

  const sorted = (k: SortKey) => (sortKey === k ? " sorted" : "");

  return (
    <>
      <PageHead
        title="SBI / SMI 리스트"
        desc={<>팀 선수별 SBI·SMI·최종 R입니다. <b>선수 이름을 클릭</b>하면 구성 종목 그래프와 세부 점수를 볼 수 있습니다.</>}
      />

      <div className="toolbar">
        <div className="group">
          <Seg value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} />
        </div>
      </div>

      <div className="panel tint">
        <Cells n={3}>
          <Cell label="팀 평균 최종 R" value={measured.length ? r1(avgR) : "-"} sub="측정 완료 선수 기준" />
          <Cell
            label="최고 R"
            value={best?.idx ? r1(best.idx.finalR) : "-"}
            sub={best ? `${best.p.name} · ${best.p.position}` : "측정 데이터 없음"}
          />
          <Cell label="측정 완료" value={measured.length} unit={`/ ${rows.length}명`} />
        </Cells>
      </div>

      <div className="panel">
        {rows.length === 0 ? (
          <Empty>등록된 선수가 없습니다.</Empty>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="rank-cell">순위</th>
                  <th className={sorted("name").trim()}>선수</th>
                  <th className={`num${sorted("sbi")}`}>SBI</th>
                  <th className={`num${sorted("smi")}`}>SMI</th>
                  <th className={`num${sorted("finalR")}`}>최종 R</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, idx }, i) => (
                  <tr key={p.id}>
                    <td><Medal rank={i + 1} /></td>
                    <td>
                      <div className="who">
                        <Avatar name={p.name} size="sm" />
                        <div className="two">
                          <span>
                            <button type="button" className="link" onClick={() => nav(`/c/sbi/${p.id}`)}>
                              {p.name}
                            </button>
                          </span>
                          <small>{p.position} · {p.grade}학년</small>
                        </div>
                      </div>
                    </td>
                    <td className={`num${sortKey === "sbi" ? "" : " faded"}`}>{idx ? r1(idx.sbi) : "-"}</td>
                    <td className={`num${sortKey === "smi" ? "" : " faded"}`}>{idx ? r1(idx.smi) : "-"}</td>
                    <td className="num">
                      <span className="brand-text strong">{idx ? r1(idx.finalR) : "-"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
