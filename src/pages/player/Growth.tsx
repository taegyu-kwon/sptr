import React, { useMemo } from "react";
import {
  ComposedChart, LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useStore } from "../../lib/store";
import { evaluate } from "../../lib/gpe";
import { PageHead, Note, Delta } from "../../components/ui";
import "../../styles/player.css";

/* 차트 테마 — 전부 CSS 토큰. SVG 속성(stroke/fill)에도 var()가 그대로 먹는다. */
const tick = { fill: "var(--fg-3)", fontSize: 11.5 };
const tooltip = {
  contentStyle: {
    background: "var(--surface-3)",
    border: "1px solid var(--line-2)",
    borderRadius: 10,
    color: "var(--fg)",
    fontSize: 12.5,
    boxShadow: "var(--shadow-pop)",
  },
  labelStyle: { color: "var(--fg-2)", marginBottom: 4 },
  itemStyle: { padding: 0 },
  cursor: { stroke: "var(--line-2)" },
};
const activeDot = { r: 4, strokeWidth: 0 };

/* 범례 색은 player.css 의 .sw-* 클래스로 */
type Swatch = "brand" | "2" | "3" | "4" | "5";
type LegendItem = { label: string; sw: Swatch };

function ChartPanel({
  title, legend, kpi, comment, children,
}: {
  title: string;
  legend: LegendItem[];
  kpi: React.ReactNode;
  comment: string;
  children: React.ReactElement;
}) {
  return (
    <div className="panel">
      <div className="chart-head">
        <div>
          <h3>{title}</h3>
          <div className="chart-legend mt8">
            {legend.map(l => (
              <span key={l.label}>
                <i className={`sw-${l.sw}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
        <div className="chart-kpi">{kpi}</div>
      </div>
      <div className="chart-box">
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
      <Note className="mt12">{comment}</Note>
    </div>
  );
}

/* 차트 머리 오른쪽의 최근 값 + 증감 */
function Kpi({ value, unit, delta, deltaUnit, digits, invert }: {
  value: React.ReactNode; unit: string; delta: number; deltaUnit?: string; digits?: number; invert?: boolean;
}) {
  return (
    <>
      <span className="display sm">
        {value}
        <span className="unit">{unit}</span>
      </span>
      <Delta value={delta} unit={deltaUnit} vs="첫 측정 대비" digits={digits} invert={invert} />
    </>
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

  const veloLabel = isPitcher ? "최고 구속" : "송구 속도";
  const cmdLabel = isPitcher ? "커맨드" : "정확도";

  return (
    <>
      <PageHead
        title="성장 · 누적 그래프"
        desc={<>측정 기록 <b>{player.records.length}회</b> 누적 — 분야별 성장 추이와 코멘트입니다.</>}
      />

      <div className="grid cols-2 gap-lg">
        <ChartPanel
          title="분야별 점수 추이"
          legend={[
            { label: "종합", sw: "brand" },
            { label: "신체", sw: "2" },
            { label: "운동능력", sw: "3" },
            { label: "실전", sw: "4" },
          ]}
          kpi={<Kpi value={last.종합} unit="점" delta={last.종합 - first.종합} digits={0} />}
          comment={scoreComment}
        >
          <ComposedChart data={rows}>
            <defs>
              <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="date" tick={tick} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis domain={[0, 100]} tick={tick} axisLine={false} tickLine={false} width={34} />
            <Tooltip {...tooltip} />
            <Area
              type="monotone" dataKey="종합" stroke="none" fill="url(#gTotal)"
              dot={false} activeDot={false} tooltipType="none" legendType="none" isAnimationActive={false}
            />
            <Line type="monotone" dataKey="종합" stroke="var(--brand)" strokeWidth={2.5} dot={false} activeDot={activeDot} />
            <Line type="monotone" dataKey="신체" stroke="var(--chart-2)" strokeWidth={2} dot={false} activeDot={activeDot} />
            <Line type="monotone" dataKey="운동능력" stroke="var(--chart-3)" strokeWidth={2} dot={false} activeDot={activeDot} />
            <Line type="monotone" dataKey="실전" stroke="var(--chart-4)" strokeWidth={2} dot={false} activeDot={activeDot} />
          </ComposedChart>
        </ChartPanel>

        <ChartPanel
          title="신체 성장"
          legend={[
            { label: "키 (cm)", sw: "2" },
            { label: "몸무게 (kg)", sw: "5" },
            { label: "골격근량 (kg)", sw: "3" },
          ]}
          kpi={<Kpi value={last.키} unit="cm" delta={last.키 - first.키} deltaUnit="cm" />}
          comment={bodyComment}
        >
          <LineChart data={rows}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="date" tick={tick} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis tick={tick} domain={["auto", "auto"]} axisLine={false} tickLine={false} width={34} />
            <Tooltip {...tooltip} />
            <Line type="monotone" dataKey="키" stroke="var(--chart-2)" strokeWidth={2} dot={false} activeDot={activeDot} />
            <Line type="monotone" dataKey="몸무게" stroke="var(--chart-5)" strokeWidth={2} dot={false} activeDot={activeDot} />
            <Line type="monotone" dataKey="골격근량" stroke="var(--chart-3)" strokeWidth={2} dot={false} activeDot={activeDot} />
          </LineChart>
        </ChartPanel>

        <ChartPanel
          title={isPitcher ? "실전 — 구속 · 커맨드" : "실전 — 송구 속도 · 정확도"}
          legend={[
            { label: `${veloLabel} (km/h)`, sw: "4" },
            { label: cmdLabel, sw: "2" },
          ]}
          kpi={<Kpi value={last.구속} unit="km/h" delta={last.구속 - first.구속} digits={0} />}
          comment={practicalComment}
        >
          <LineChart data={rows}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="date" tick={tick} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis tick={tick} domain={["auto", "auto"]} axisLine={false} tickLine={false} width={34} />
            <Tooltip {...tooltip} />
            <Line type="monotone" dataKey="구속" name={veloLabel} stroke="var(--chart-4)" strokeWidth={2} dot={false} activeDot={activeDot} />
            <Line type="monotone" dataKey="커맨드" name={cmdLabel} stroke="var(--chart-2)" strokeWidth={2} dot={false} activeDot={activeDot} />
          </LineChart>
        </ChartPanel>

        <ChartPanel
          title="운동능력 — 60yd 대시 · 스쿼트"
          legend={[
            { label: "60yd (초, 낮을수록 좋음)", sw: "5" },
            { label: "스쿼트 (kg)", sw: "3" },
          ]}
          kpi={<Kpi value={last["60yd"]} unit="초" delta={last["60yd"] - first["60yd"]} digits={2} invert />}
          comment={athleticComment}
        >
          <LineChart data={rows}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="date" tick={tick} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis yAxisId="l" tick={tick} domain={["auto", "auto"]} axisLine={false} tickLine={false} width={34} />
            <YAxis yAxisId="r" orientation="right" tick={tick} domain={["auto", "auto"]} axisLine={false} tickLine={false} width={34} />
            <Tooltip {...tooltip} />
            <Line yAxisId="l" type="monotone" dataKey="60yd" name="60yd (초, 낮을수록 좋음)" stroke="var(--chart-5)" strokeWidth={2} dot={false} activeDot={activeDot} />
            <Line yAxisId="r" type="monotone" dataKey="스쿼트" name="스쿼트 (kg)" stroke="var(--chart-3)" strokeWidth={2} dot={false} activeDot={activeDot} />
          </LineChart>
        </ChartPanel>
      </div>
    </>
  );
}
