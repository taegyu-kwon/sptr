/* ================================================================
   측정 센터 지도 — 측정 장비를 갖춘 트레이닝센터·레슨장 목록.
   지금은 예시(가짜) 데이터만 있다. 서버 연결 후에는 centers 테이블로 옮기고,
   센터 앱 연동(integration)·예약(booking) 칸을 그대로 채워 쓰도록 구조만 열어 둔다.
   ================================================================ */

import { addDays, todayISO } from "./schedule";

/** 시·도 17곳 */
export type Region =
  | "서울" | "인천" | "경기" | "강원" | "충남" | "세종" | "충북" | "대전" | "경북"
  | "전북" | "대구" | "울산" | "광주" | "전남" | "경남" | "부산" | "제주";

/** 간단 지도(타일)에서 각 시·도의 자리 — 실제 지도 API를 붙이기 전까지 쓴다 */
export const REGION_TILES: { region: Region; row: number; col: number }[] = [
  { region: "인천", row: 0, col: 0 }, { region: "서울", row: 0, col: 1 }, { region: "경기", row: 0, col: 2 }, { region: "강원", row: 0, col: 3 },
  { region: "충남", row: 1, col: 0 }, { region: "세종", row: 1, col: 1 }, { region: "충북", row: 1, col: 2 }, { region: "경북", row: 1, col: 3 },
  { region: "전북", row: 2, col: 0 }, { region: "대전", row: 2, col: 1 }, { region: "대구", row: 2, col: 2 }, { region: "울산", row: 2, col: 3 },
  { region: "광주", row: 3, col: 0 }, { region: "전남", row: 3, col: 1 }, { region: "경남", row: 3, col: 2 }, { region: "부산", row: 3, col: 3 },
  { region: "제주", row: 4, col: 0 },
];

/** 측정 장비 종류 */
export type EquipmentId =
  | "rapsodo_pitch" | "rapsodo_hit" | "trackman" | "blast" | "highspeed" | "forceplate" | "radar" | "inbody";

export const EQUIPMENT: Record<EquipmentId, { label: string; short: string; measures: string[] }> = {
  rapsodo_pitch: { label: "랩소도 피칭", short: "랩소도(투구)", measures: ["구속", "회전수", "회전 효율", "수직·수평 무브먼트", "릴리스 높이"] },
  rapsodo_hit:   { label: "랩소도 히팅", short: "랩소도(타격)", measures: ["타구 속도", "발사각", "비거리", "스프레이 방향"] },
  trackman:      { label: "트랙맨", short: "트랙맨", measures: ["구속", "회전수", "익스텐션", "무브먼트", "타구 속도", "발사각"] },
  blast:         { label: "스윙 센서(블라스트 등)", short: "스윙 센서", measures: ["배트 스피드", "어택 앵글", "임팩트까지 시간"] },
  highspeed:     { label: "고속 카메라", short: "고속 카메라", measures: ["투구·스윙 동작 영상 분석"] },
  forceplate:    { label: "포스 플레이트", short: "포스 플레이트", measures: ["점프 파워", "좌우 하체 밸런스", "지면 반력"] },
  radar:         { label: "스피드건·레이더", short: "스피드건", measures: ["구속", "송구 속도"] },
  inbody:        { label: "체성분 측정기", short: "체성분", measures: ["체중", "골격근량", "체지방률"] },
};

export const EQUIPMENT_IDS = Object.keys(EQUIPMENT) as EquipmentId[];

export type CenterPrice = {
  label: string;
  /** 원 단위. null 이면 "문의" */
  price: number | null;
  unit: "1회" | "1인" | "월";
  note?: string;
};

export type MeasureCenter = {
  id: string;
  name: string;
  kind: "트레이닝센터" | "레슨장" | "아카데미";
  region: Region;
  district: string;
  address: string;
  /** 실제 지도 API를 붙일 때 쓰는 좌표(예시 데이터는 대략적인 도시 좌표) */
  lat: number;
  lng: number;
  equipment: EquipmentId[];
  prices: CenterPrice[];
  /** 팀 단위 단체 측정 가능 여부 */
  groupMeasure: boolean;
  contact: { phone: string; instagram?: string; web?: string };
  hours: string;
  /** listed: 목록에만 있음 / partner: SPTR 협업 센터 */
  status: "listed" | "partner";
  /** 센터 운영 앱 연동 — 연동되면 측정 결과가 선수 프로필로 바로 들어온다 */
  integration: { connected: boolean; source?: "center_app"; externalId?: string; lastSyncAt?: string };
  /** 예약 — 아직 기능 없음(화면에는 전화 문의만 둔다). 나중에 enabled 와 방식만 채운다 */
  booking: { enabled: boolean; method?: "in_app" | "external"; url?: string };
  updatedAt: string;
};

/** 예시 센터 — 이름·연락처·주소는 모두 가짜다 */
export const SAMPLE_CENTERS: MeasureCenter[] = [
  {
    id: "ctr-01", name: "강남 피칭 랩", kind: "트레이닝센터", region: "서울", district: "강남구", address: "서울 강남구",
    lat: 37.497, lng: 127.027, equipment: ["rapsodo_pitch", "rapsodo_hit", "highspeed", "forceplate", "inbody"],
    prices: [{ label: "투구 측정", price: 60000, unit: "1회" }, { label: "타격 측정", price: 60000, unit: "1회" }, { label: "팀 단체 측정", price: 35000, unit: "1인", note: "10명 이상" }],
    groupMeasure: true, contact: { phone: "02-000-0001", instagram: "@gangnam_pitchinglab" }, hours: "평일 13–22시 · 주말 10–18시",
    status: "partner", integration: { connected: true, source: "center_app", externalId: "demo-a", lastSyncAt: addDays(todayISO(), -2) }, booking: { enabled: false }, updatedAt: addDays(todayISO(), -2),
  },
  {
    id: "ctr-02", name: "수원 베이스볼 퍼포먼스 센터", kind: "트레이닝센터", region: "경기", district: "수원시", address: "경기 수원시",
    lat: 37.263, lng: 127.028, equipment: ["trackman", "blast", "highspeed", "forceplate"],
    prices: [{ label: "종합 측정(투구+타격+체력)", price: 90000, unit: "1회" }, { label: "팀 단체 측정", price: 45000, unit: "1인", note: "15명 이상" }],
    groupMeasure: true, contact: { phone: "031-000-0002" }, hours: "매일 10–22시",
    status: "partner", integration: { connected: true, source: "center_app", externalId: "demo-b", lastSyncAt: addDays(todayISO(), -4) }, booking: { enabled: false }, updatedAt: addDays(todayISO(), -4),
  },
  {
    id: "ctr-03", name: "송파 베이스볼 랩", kind: "레슨장", region: "서울", district: "송파구", address: "서울 송파구",
    lat: 37.514, lng: 127.106, equipment: ["rapsodo_hit", "blast", "radar"],
    prices: [{ label: "타격 측정", price: 40000, unit: "1회" }, { label: "레슨 포함 측정", price: 70000, unit: "1회" }],
    groupMeasure: false, contact: { phone: "02-000-0003" }, hours: "평일 15–22시",
    status: "listed", integration: { connected: false }, booking: { enabled: false }, updatedAt: "2026-10-28",
  },
  {
    id: "ctr-04", name: "일산 야구 트레이닝 센터", kind: "트레이닝센터", region: "경기", district: "고양시", address: "경기 고양시",
    lat: 37.658, lng: 126.832, equipment: ["rapsodo_pitch", "radar", "inbody"],
    prices: [{ label: "투구 측정", price: 50000, unit: "1회" }, { label: "팀 단체 측정", price: null, unit: "1인", note: "인원에 따라 협의" }],
    groupMeasure: true, contact: { phone: "031-000-0004" }, hours: "평일 14–22시 · 토 10–16시",
    status: "listed", integration: { connected: false }, booking: { enabled: false }, updatedAt: "2026-10-20",
  },
  {
    id: "ctr-05", name: "성남 피칭 스튜디오", kind: "레슨장", region: "경기", district: "성남시", address: "경기 성남시",
    lat: 37.42, lng: 127.127, equipment: ["rapsodo_pitch", "highspeed"],
    prices: [{ label: "투구 측정 + 영상 분석", price: 55000, unit: "1회" }],
    groupMeasure: false, contact: { phone: "031-000-0005" }, hours: "예약제",
    status: "listed", integration: { connected: false }, booking: { enabled: false }, updatedAt: "2026-09-30",
  },
  {
    id: "ctr-06", name: "인천 베이스볼 센터", kind: "트레이닝센터", region: "인천", district: "연수구", address: "인천 연수구",
    lat: 37.41, lng: 126.678, equipment: ["rapsodo_pitch", "rapsodo_hit", "inbody"],
    prices: [{ label: "투구 또는 타격 측정", price: 45000, unit: "1회" }, { label: "팀 단체 측정", price: 30000, unit: "1인", note: "10명 이상" }],
    groupMeasure: true, contact: { phone: "032-000-0006" }, hours: "평일 13–21시",
    status: "listed", integration: { connected: false }, booking: { enabled: false }, updatedAt: "2026-10-12",
  },
  {
    id: "ctr-07", name: "대전 퍼포먼스 랩", kind: "트레이닝센터", region: "대전", district: "유성구", address: "대전 유성구",
    lat: 36.362, lng: 127.356, equipment: ["trackman", "forceplate", "inbody"],
    prices: [{ label: "종합 측정", price: 80000, unit: "1회" }, { label: "팀 단체 측정", price: 40000, unit: "1인" }],
    groupMeasure: true, contact: { phone: "042-000-0007" }, hours: "평일 12–21시",
    status: "listed", integration: { connected: false }, booking: { enabled: false }, updatedAt: "2026-10-05",
  },
  {
    id: "ctr-08", name: "청주 야구 아카데미", kind: "아카데미", region: "충북", district: "청주시", address: "충북 청주시",
    lat: 36.642, lng: 127.489, equipment: ["radar", "highspeed"],
    prices: [{ label: "구속 측정 + 영상", price: 30000, unit: "1회" }],
    groupMeasure: true, contact: { phone: "043-000-0008" }, hours: "평일 16–21시",
    status: "listed", integration: { connected: false }, booking: { enabled: false }, updatedAt: "2026-09-18",
  },
  {
    id: "ctr-09", name: "대구 피칭 랩", kind: "트레이닝센터", region: "대구", district: "수성구", address: "대구 수성구",
    lat: 35.858, lng: 128.631, equipment: ["rapsodo_pitch", "rapsodo_hit", "blast", "forceplate"],
    prices: [{ label: "투구 측정", price: 50000, unit: "1회" }, { label: "타격 측정", price: 50000, unit: "1회" }, { label: "팀 단체 측정", price: 32000, unit: "1인", note: "12명 이상" }],
    groupMeasure: true, contact: { phone: "053-000-0009" }, hours: "매일 11–22시",
    status: "listed", integration: { connected: false }, booking: { enabled: false }, updatedAt: "2026-10-30",
  },
  {
    id: "ctr-10", name: "부산 베이스볼 랩", kind: "트레이닝센터", region: "부산", district: "해운대구", address: "부산 해운대구",
    lat: 35.163, lng: 129.163, equipment: ["trackman", "blast", "highspeed", "inbody"],
    prices: [{ label: "종합 측정", price: 85000, unit: "1회" }, { label: "팀 단체 측정", price: 42000, unit: "1인", note: "10명 이상" }],
    groupMeasure: true, contact: { phone: "051-000-0010" }, hours: "평일 13–22시 · 주말 10–17시",
    status: "listed", integration: { connected: false }, booking: { enabled: false }, updatedAt: "2026-11-02",
  },
  {
    id: "ctr-11", name: "창원 타격 레슨장", kind: "레슨장", region: "경남", district: "창원시", address: "경남 창원시",
    lat: 35.228, lng: 128.681, equipment: ["rapsodo_hit", "radar"],
    prices: [{ label: "타격 측정", price: 35000, unit: "1회" }],
    groupMeasure: false, contact: { phone: "055-000-0011" }, hours: "평일 15–22시",
    status: "listed", integration: { connected: false }, booking: { enabled: false }, updatedAt: "2026-09-12",
  },
  {
    id: "ctr-12", name: "광주 야구 트레이닝 센터", kind: "트레이닝센터", region: "광주", district: "서구", address: "광주 서구",
    lat: 35.152, lng: 126.89, equipment: ["rapsodo_pitch", "forceplate", "inbody"],
    prices: [{ label: "투구 측정", price: 45000, unit: "1회" }, { label: "체력 측정", price: 30000, unit: "1회" }],
    groupMeasure: true, contact: { phone: "062-000-0012" }, hours: "평일 13–21시",
    status: "listed", integration: { connected: false }, booking: { enabled: false }, updatedAt: "2026-10-15",
  },
  {
    id: "ctr-13", name: "전주 피칭 아카데미", kind: "아카데미", region: "전북", district: "전주시", address: "전북 전주시",
    lat: 35.824, lng: 127.148, equipment: ["rapsodo_pitch", "radar"],
    prices: [{ label: "투구 측정", price: null, unit: "1회", note: "문의" }],
    groupMeasure: false, contact: { phone: "063-000-0013" }, hours: "예약제",
    status: "listed", integration: { connected: false }, booking: { enabled: false }, updatedAt: "2026-08-29",
  },
  {
    id: "ctr-14", name: "원주 베이스볼 센터", kind: "트레이닝센터", region: "강원", district: "원주시", address: "강원 원주시",
    lat: 37.342, lng: 127.92, equipment: ["radar", "inbody", "highspeed"],
    prices: [{ label: "기본 측정(구속·체성분·영상)", price: 35000, unit: "1회" }, { label: "팀 단체 측정", price: 25000, unit: "1인" }],
    groupMeasure: true, contact: { phone: "033-000-0014" }, hours: "평일 14–21시",
    status: "listed", integration: { connected: false }, booking: { enabled: false }, updatedAt: "2026-09-25",
  },
];

/** 가격 표시 — null 이면 "문의" */
export const fmtPrice = (p: CenterPrice) =>
  p.price === null ? "문의" : `${p.price.toLocaleString("ko-KR")}원 / ${p.unit}`;

/** 개인 1회 측정 가격 중 가장 낮은 값(단체·월 가격 제외, 정렬용). 없으면 Infinity */
export const minPrice = (c: MeasureCenter) => {
  const vals = c.prices.filter(p => p.unit === "1회").map(p => p.price).filter((v): v is number => v !== null);
  return vals.length ? Math.min(...vals) : Infinity;
};

/** 이 센터에서 측정 가능한 항목(장비별 항목을 겹치지 않게 모음) */
export const measurableItems = (c: MeasureCenter) =>
  Array.from(new Set(c.equipment.flatMap(e => EQUIPMENT[e].measures)));
