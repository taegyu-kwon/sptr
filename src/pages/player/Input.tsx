import React, { useState } from "react";
import { useStore } from "../../lib/store";
import { evaluate } from "../../lib/gpe";
import { fmtDate } from "../../lib/format";
import { SnapshotDetail } from "../../components/MeasureForm";
import { GradeBadge, Notice, PageHead, Section } from "../../components/ui";
import "../../styles/measure.css";

/** 선수 화면 "측정 기록" — 감독·코치가 입력한 측정값을 날짜별로 보기만 한다 */
export default function InputPage() {
  const { db, user } = useStore();
  const player = db.players.find(p => p.id === user?.playerId);
  /** 선택한 측정일. null이면 가장 최근 기록 */
  const [picked, setPicked] = useState<string | null>(null);

  if (!player) return <PageHead title="내 측정 기록" desc="연결된 선수 정보를 찾을 수 없습니다." />;

  // 최근 측정이 위로
  const rows = player.records.map((snap, index) => ({ snap, index, res: evaluate(snap) })).reverse();
  const current = rows.find(r => `${r.index}:${r.snap.date}` === picked) ?? rows[0];

  return (
    <>
      <PageHead
        title="내 측정 기록"
        desc="신체·운동능력·실전 측정값을 측정일별로 확인합니다. 능력치·성장 그래프·팀 내 순위는 이 기록으로 계산됩니다."
      />

      <Notice kind="info">
        측정값은 감독·코치가 입력합니다. 값이 실제와 다르면 코칭스태프에게 수정을 요청하세요.
      </Notice>

      <Section title="측정 이력" meta={`총 ${rows.length}회 · 날짜를 누르면 그날의 측정값을 봅니다`} className="mt16">
        <div className="panel">
          <div className="tbl-wrap">
            <table className="tbl measure-tbl">
              <thead>
                <tr>
                  <th>측정일</th>
                  <th className="num">키</th>
                  <th className="num">몸무게</th>
                  <th className="num">{current.snap.practical.kind === "투수" ? "최고 구속" : "송구 속도"}</th>
                  <th className="num">종합 점수</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.index}:${r.snap.date}`}
                    className={`clickable${r === current ? " on" : ""}`}
                    onClick={() => setPicked(`${r.index}:${r.snap.date}`)}
                  >
                    <td>
                      <button type="button" className="link" aria-pressed={r === current}>
                        {fmtDate(r.snap.date)}
                      </button>
                      {i === 0 && <span className="pill brand">최근</span>}
                    </td>
                    <td className="num">{r.snap.body.height} cm</td>
                    <td className="num">{r.snap.body.weight} kg</td>
                    <td className="num">{r.snap.practical.maxVelo} km/h</td>
                    <td className="num">
                      <span className="flex gap8">
                        <b>{Math.round(r.res.total)}</b>
                        <GradeBadge grade={r.res.totalGrade} size={20} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section title={`${fmtDate(current.snap.date)} 측정값`} meta="보기 전용">
        <div className="panel">
          <SnapshotDetail snap={current.snap} />
        </div>
      </Section>
    </>
  );
}
