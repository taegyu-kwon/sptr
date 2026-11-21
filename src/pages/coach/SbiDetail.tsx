import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../../lib/store";
import { fmtDate } from "../../lib/format";
import PlayerSbiCard from "../../components/PlayerSbiCard";
import { SbiHistoryTable, SbiRawData, sbiHistoryOf } from "../../components/SbiHistory";
import { SbiCalculator } from "../Sbi";
import { Empty, Notice, PageHead, Section } from "../../components/ui";
import { Icon } from "../../components/icons";
import "../../styles/coach.css";
import "../../styles/measure.css";

export default function CoachSbiDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db, addSbiMetrics, deleteSbiMetrics } = useStore();
  const player = db.players.find(p => p.id === id);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [msg]);

  if (!player) {
    return (
      <PageHead
        title="선수를 찾을 수 없습니다"
        actions={<button type="button" className="btn secondary" onClick={() => nav("/c/sbi")}>리스트로</button>}
      />
    );
  }

  const m = player.sbiMetrics;
  const history = sbiHistoryOf(player);

  const openForm = () => {
    setOpen(true);
    setMsg(null);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return (
    <>
      <PageHead
        title={player.name}
        desc={<>{player.position} · {player.grade}학년 · 등번호 {player.backNumber}</>}
        actions={
          <>
            <button type="button" className="btn ghost sm" onClick={() => nav("/c/sbi")}>
              <Icon.ArrowLeft />
              SBI/SMI 리스트
            </button>
            {!open && (
              <button type="button" className="btn sm" onClick={openForm}>
                <Icon.Plus />
                측정값 입력
              </button>
            )}
          </>
        }
      />

      <PlayerSbiCard player={player} />

      {msg && <Notice kind="ok" className="mt16">{msg}</Notice>}

      <div ref={formRef} className="measure-anchor" />
      {open && (
        <SbiCalculator
          key={`${player.id}:${history.length}`}
          player={player}
          onSave={metrics => {
            addSbiMetrics(player.id, metrics);
            setOpen(false);
            setMsg(`${fmtDate(metrics.date!)} SBI/SMI 측정값을 저장했습니다. 측정 이력에 추가되었습니다.`);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onCancel={() => setOpen(false)}
        />
      )}

      <Section
        title="지난 측정 이력"
        meta={history.length ? `총 ${history.length}회 · 지난 측정의 신장·구속은 그 측정일 이전 측정 기록 기준` : undefined}
      >
        <div className="panel">
          {history.length ? (
            <SbiHistoryTable
              player={player}
              onDelete={index => {
                const target = history[index];
                deleteSbiMetrics(player.id, index);
                setMsg(`${target?.date ? fmtDate(target.date) : "측정일 미기록"} SBI/SMI 측정을 삭제했습니다.`);
              }}
            />
          ) : (
            <Empty>아직 저장된 SBI/SMI 측정이 없습니다. '측정값 입력'으로 첫 측정을 저장하세요.</Empty>
          )}
        </div>
      </Section>

      {m && <SbiRawData player={player} m={m} />}
    </>
  );
}
