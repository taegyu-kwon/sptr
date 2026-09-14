import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../lib/store";
import { evaluatePlayerSbi, r1 } from "../../lib/sbi";
import { Medal } from "../../components/ui";

type SortKey = "finalR" | "sbi" | "smi" | "name";

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

  return (
    <>
      <h1 className="page-title">SBI / SMI 리스트</h1>
      <p className="page-desc">
        팀 선수별 SBI·SMI·최종 R입니다. <b>선수 이름을 클릭</b>하면 구성 종목 그래프와 세부 점수를 볼 수 있습니다.
      </p>

      <div className="tabs">
        <button className={sortKey === "finalR" ? "on" : ""} onClick={() => setSortKey("finalR")}>최종 R 순</button>
        <button className={sortKey === "sbi" ? "on" : ""} onClick={() => setSortKey("sbi")}>SBI 순</button>
        <button className={sortKey === "smi" ? "on" : ""} onClick={() => setSortKey("smi")}>SMI 순</button>
        <button className={sortKey === "name" ? "on" : ""} onClick={() => setSortKey("name")}>이름 순</button>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>순위</th>
              <th>선수</th>
              <th>포지션</th>
              <th>학년</th>
              <th className="num">SBI</th>
              <th className="num">SMI</th>
              <th className="num">최종 R</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, idx }, i) => (
              <tr key={p.id}>
                <td><Medal rank={i + 1} /></td>
                <td>
                  <button
                    type="button"
                    onClick={() => nav(`/c/sbi/${p.id}`)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "var(--accent)",
                      fontWeight: 700,
                      fontSize: "inherit",
                      fontFamily: "inherit",
                      cursor: "pointer",
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                    }}
                  >
                    {p.name}
                  </button>
                </td>
                <td>{p.position}</td>
                <td>{p.grade}학년</td>
                <td className="num">{idx ? r1(idx.sbi) : "-"}</td>
                <td className="num">{idx ? r1(idx.smi) : "-"}</td>
                <td className="num" style={{ color: "var(--accent)", fontWeight: 700 }}>
                  {idx ? r1(idx.finalR) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
