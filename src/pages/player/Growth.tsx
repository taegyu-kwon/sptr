import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useStore } from "../../lib/store";
import { evaluate } from "../../lib/gpe";

const chartTheme = {
  grid: "#262629",
  tick: { fill: "#8e8e94", fontSize: 12 },
  tooltip: {
    contentStyle: { background: "#151517", border: "1px solid #38383c", borderRadius: 4, color: "#ececee" },
  },
};

function ChartCard({ title, comment, children }: { title: string; comment: string; children: React.ReactElement }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
      <div className="feedback-item team mt8 small">{comment}</div>
    </div>
  );
}

export default function GrowthPage() {
  const { db, user } = useStore();
  const player = db.players.find(p => p.id === user?.playerId)!;

  const rows = useMemo(
    () =>
      player.records.map(s => {
        const r = evaluate(s);
        return {
          date: s.date.slice(2).split("-").join("."),
          종합: r.total,
          신체: r.body.score,
          운동능력: r.athletic.score,
          실전: r.practical.score,
          키: s.body.height,
          몸무게: s.body.weight,
          골격근량: s.body.skeletalMuscle,
          구속: s.practical.maxVelo,
          커맨드: s.practical.command,
          "60yd": s.athletic.dash60,
          스쿼트: s.athletic.squat,
        };
      }),
    [player]
  );

  const first = rows[0];
  const last = rows[rows.length - 1];
  const diff = (k: keyof typeof first) => Math.round(((last[k] as number) - (first[k] as number)) * 10) / 10;

  const isPitcher = player.records[player.records.length - 1].practical.kind === "투수";

  const scoreComment = `측정 시작 이후 종합 점수가 ${diff("종합") >= 0 ? "+" : ""}${diff("종합")}점 변했습니다. ${
    diff("실전") > diff("신체")
      ? "실전 능력이 신체 성장보다 빠르게 올라오고 있어, 피지컬 훈련 병행이 필요합니다."
      : "신체 성장이 실전 지표를 견인하고 있는 건강한 성장 곡선입니다."
  }`;
  const bodyComment = `키 ${diff("키") >= 0 ? "+" : ""}${diff("키")}cm, 몸무게 ${diff("몸무게") >= 0 ? "+" : ""}${diff("몸무게")}kg, 골격근량 ${diff("골격근량") >= 0 ? "+" : ""}${diff("골격근량")}kg. ${
    diff("키") >= 4 ? "급성장 구간입니다. 유연성 관리와 충분한 수면·영양이 중요합니다." : "성장 속도가 완만한 구간으로, 근력·기술 훈련에 집중하기 좋은 시기입니다."
  }`;
  const practicalComment = isPitcher
    ? `최고 구속 ${diff("구속") >= 0 ? "+" : ""}${diff("구속")}km/h, 커맨드 ${diff("커맨드") >= 0 ? "+" : ""}${diff("커맨드")}점. ${
        diff("커맨드") < diff("구속") ? "구속 상승 대비 커맨드 발전이 느립니다. 타겟 불펜 비중을 높이세요." : "구속과 커맨드가 균형 있게 발전 중입니다."
      }`
    : `송구 속도 ${diff("구속") >= 0 ? "+" : ""}${diff("구속")}km/h, 정확도 ${diff("커맨드") >= 0 ? "+" : ""}${diff("커맨드")}점 변화. 수비 툴이 꾸준히 발전하고 있습니다.`;
  const athleticComment = `60yd ${diff("60yd") <= 0 ? "" : "+"}${diff("60yd")}초, 스쿼트 ${diff("스쿼트") >= 0 ? "+" : ""}${diff("스쿼트")}kg 변화. ${
    diff("스쿼트") >= 15 ? "하체 출력이 크게 늘었습니다. 구속/타구속도 상승으로 이어질 가능성이 높습니다." : "하체 근력 향상 폭을 더 키우면 실전 지표 상승이 따라옵니다."
  }`;

  return (
    <>
      <h1 className="page-title">성장 · 누적 그래프</h1>
      <p className="page-desc">측정 기록 {player.records.length}회 누적 — 분야별 성장 추이와 코멘트입니다.</p>

      <div className="grid cols-2">
        <ChartCard title="분야별 점수 추이" comment={scoreComment}>
          <LineChart data={rows}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={chartTheme.tick} />
            <YAxis domain={[0, 100]} tick={chartTheme.tick} />
            <Tooltip {...chartTheme.tooltip} />
            <Legend />
            <Line type="monotone" dataKey="종합" stroke="#e8eefc" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="신체" stroke="#2f81f7" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="운동능력" stroke="#3fb950" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="실전" stroke="#a371f7" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="신체 성장 (키 · 몸무게 · 골격근량)" comment={bodyComment}>
          <LineChart data={rows}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={chartTheme.tick} />
            <YAxis tick={chartTheme.tick} domain={["dataMin - 5", "dataMax + 5"]} />
            <Tooltip {...chartTheme.tooltip} />
            <Legend />
            <Line type="monotone" dataKey="키" stroke="#2f81f7" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="몸무게" stroke="#d29922" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="골격근량" stroke="#3fb950" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>

        <ChartCard title={isPitcher ? "실전 (구속 · 커맨드)" : "실전 (송구 속도 · 정확도)"} comment={practicalComment}>
          <LineChart data={rows}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={chartTheme.tick} />
            <YAxis tick={chartTheme.tick} domain={["dataMin - 5", "dataMax + 5"]} />
            <Tooltip {...chartTheme.tooltip} />
            <Legend />
            <Line type="monotone" dataKey="구속" name={isPitcher ? "최고 구속" : "송구 속도"} stroke="#a371f7" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="커맨드" name={isPitcher ? "커맨드" : "정확도"} stroke="#2f81f7" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="운동능력 (60yd 대시 · 스쿼트)" comment={athleticComment}>
          <LineChart data={rows}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={chartTheme.tick} />
            <YAxis yAxisId="l" tick={chartTheme.tick} domain={["dataMin - 0.3", "dataMax + 0.3"]} />
            <YAxis yAxisId="r" orientation="right" tick={chartTheme.tick} domain={["dataMin - 10", "dataMax + 10"]} />
            <Tooltip {...chartTheme.tooltip} />
            <Legend />
            <Line yAxisId="l" type="monotone" dataKey="60yd" name="60yd (초, 낮을수록 좋음)" stroke="#d29922" strokeWidth={2} dot={{ r: 3 }} />
            <Line yAxisId="r" type="monotone" dataKey="스쿼트" name="스쿼트 (kg)" stroke="#3fb950" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>
      </div>
    </>
  );
}
