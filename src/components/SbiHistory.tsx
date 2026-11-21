import React, { useState } from "react";
import type { Player, SbiMetrics } from "../lib/types";
import { latest } from "../lib/gpe";
import { evaluateSbi, r1 } from "../lib/sbi";
import { fmtDate } from "../lib/format";
import { Section } from "./ui";
import "../styles/measure.css";

/** SBI/SMI 측정 이력(측정일 오름차순). 이력이 없던 예전 데이터는 sbiMetrics 1건을 이력으로 본다 */
export function sbiHistoryOf(player: Player): SbiMetrics[] {
  return player.sbiHistory ?? (player.sbiMetrics ? [player.sbiMetrics] : []);
}

/**
 * 이력 한 줄의 점수. 신장·구속은 SBI 측정값에 들어 있지 않아 선수의 측정 기록에서 읽는다.
 * 가장 최근 측정은 요약 카드와 같게 최근 측정 기록을, 지난 측정은 그 측정일 이전의 가장 가까운 기록을 쓴다.
 */
function scoreOf(player: Player, m: SbiMetrics, isLatest: boolean) {
  const recs = player.records;
  let snap = latest(player);
  if (!isLatest && m.date) {
    const before = recs.filter(r => r.date.slice(0, 10) <= m.date!);
    snap = before.length ? before[before.length - 1] : recs[0];
  }
  return evaluateSbi(snap.body.height, snap.practical.maxVelo, m);
}

/** 지난 측정 이력 표(날짜·SBI·SMI·최종 R). onDelete를 주면(코치) 줄마다 삭제 버튼이 붙는다 */
export function SbiHistoryTable({ player, onDelete }: { player: Player; onDelete?: (index: number) => void }) {
  const [confirm, setConfirm] = useState<number | null>(null);
  const history = sbiHistoryOf(player);
  // 최근 측정이 위로
  const rows = history.map((m, index) => ({ m, index, res: scoreOf(player, m, index === history.length - 1) })).reverse();

  return (
    <div className="tbl-wrap">
      <table className="tbl measure-tbl">
        <thead>
          <tr>
            <th>측정일</th>
            <th className="num">SBI</th>
            <th className="num">SMI</th>
            <th className="num">최종 R</th>
            {onDelete && <th aria-label="삭제" />}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, index, res }, i) => (
            <tr key={`${index}:${m.date ?? ""}`}>
              <td>
                {m.date ? fmtDate(m.date) : <span className="dim">측정일 미기록</span>}
                {i === 0 && <span className="pill brand">최근</span>}
              </td>
              <td className="num">{r1(res.sbi)}</td>
              <td className="num">{r1(res.smi)}</td>
              <td className="num"><span className="brand-text strong">{r1(res.finalR)}</span></td>
              {onDelete && (
                <td className="acts">
                  {confirm === index ? (
                    <>
                      <button
                        type="button"
                        className="btn danger sm"
                        onClick={() => { setConfirm(null); onDelete(index); }}
                      >
                        정말 삭제
                      </button>
                      <button type="button" className="btn ghost sm" onClick={() => setConfirm(null)}>취소</button>
                    </>
                  ) : (
                    <button type="button" className="btn ghost danger sm" onClick={() => setConfirm(index)}>삭제</button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 측정 원자료(가장 최근 측정 1건) */
export function SbiRawData({ player, m }: { player: Player; m: SbiMetrics }) {
  const s = latest(player);
  return (
    <Section title="측정 원자료" meta={m.date ? `측정일 ${fmtDate(m.date)}` : "측정일 미기록"}>
      <div className="panel">
        <div className="columns n2">
          <div className="col">
            <div className="col-head"><h4>신체 · 스피드</h4></div>
            <div className="kv">
              <div className="kv-row"><span className="k">신장 / 체중</span><span className="v">{s.body.height}cm / {s.body.weight}kg</span></div>
              <div className="kv-row"><span className="k">최고 구속</span><span className="v">{s.practical.maxVelo} km/h</span></div>
              <div className="kv-row"><span className="k">10m 스프린트</span><span className="v">{m.sprint} 초</span></div>
              <div className="kv-row"><span className="k">버티컬 점프</span><span className="v">{m.vertical} cm</span></div>
            </div>
          </div>
          <div className="col">
            <div className="col-head"><h4>근력 · 역학</h4></div>
            <div className="kv">
              <div className="kv-row"><span className="k">스쿼트 / 외발 데드 / 푸쉬업</span><span className="v">{m.squatReps}개 / {m.deadReps}회 / {m.pushReps}개</span></div>
              <div className="kv-row"><span className="k">제동력 착지거리</span><span className="v">{m.landDist} cm</span></div>
              <div className="kv-row"><span className="k">가속효율 (상체만 / 전신)</span><span className="v">{m.upperOnly}m / {m.fullBody}m</span></div>
              <div className="kv-row"><span className="k">팔꿈치 폄 Method 2</span><span className="v">{m.elbowThrow} m</span></div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
