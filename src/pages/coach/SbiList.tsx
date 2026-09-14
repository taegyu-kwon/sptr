import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../lib/store";
import { evaluatePlayerSbi, r1 } from "../../lib/sbi";
import { Empty, Medal, PageHead, Seg } from "../../components/ui";
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

      <div className="card">
        {rows.length === 0 ? (
          <Empty>등록된 선수가 없습니다.</Empty>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>순위</th>
                  <th className={sorted("name").trim()}>선수</th>
                  <th>포지션</th>
                  <th>학년</th>
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
                      <button type="button" className="link" onClick={() => nav(`/c/sbi/${p.id}`)}>
                        {p.name}
                      </button>
                    </td>
                    <td>{p.position}</td>
                    <td>{p.grade}학년</td>
                    <td className="num">{idx ? r1(idx.sbi) : "-"}</td>
                    <td className="num">{idx ? r1(idx.smi) : "-"}</td>
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
