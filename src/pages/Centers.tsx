import React, { useMemo, useState } from "react";
import {
  EQUIPMENT, EQUIPMENT_IDS, REGION_TILES, SAMPLE_CENTERS, fmtPrice, measurableItems, minPrice,
  type EquipmentId, type MeasureCenter, type Region,
} from "../lib/centers";
import { Empty, Notice, PageHead, Seg } from "../components/ui";
import { Icon } from "../components/icons";
import "../styles/centers.css";

type SortKey = "name" | "price";

export default function CentersPage() {
  const centers = SAMPLE_CENTERS;
  const [query, setQuery] = useState("");
  const [equip, setEquip] = useState<EquipmentId[]>([]);
  const [region, setRegion] = useState<Region | null>(null);
  const [groupOnly, setGroupOnly] = useState(false);
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toggleEquip = (id: EquipmentId) =>
    setEquip(cur => (cur.includes(id) ? cur.filter(e => e !== id) : [...cur, id]));

  /** 지역을 뺀 나머지 조건 — 지도 타일의 숫자는 이 기준으로 센다 */
  const baseFiltered = useMemo(() => {
    const q = query.trim();
    return centers.filter(c =>
      (!q || c.name.includes(q) || c.district.includes(q) || c.region.includes(q)) &&
      equip.every(e => c.equipment.includes(e)) &&
      (!groupOnly || c.groupMeasure) &&
      (!linkedOnly || c.integration.connected)
    );
  }, [centers, query, equip, groupOnly, linkedOnly]);

  const list = useMemo(() => {
    const rows = baseFiltered.filter(c => !region || c.region === region);
    return [...rows].sort((a, b) =>
      sort === "price" ? minPrice(a) - minPrice(b) || a.name.localeCompare(b.name, "ko") : a.name.localeCompare(b.name, "ko")
    );
  }, [baseFiltered, region, sort]);

  const countByRegion = useMemo(() => {
    const m = new Map<Region, number>();
    baseFiltered.forEach(c => m.set(c.region, (m.get(c.region) ?? 0) + 1));
    return m;
  }, [baseFiltered]);

  const selected = list.find(c => c.id === selectedId) ?? null;
  const hasFilter = !!query || equip.length > 0 || !!region || groupOnly || linkedOnly;
  const reset = () => { setQuery(""); setEquip([]); setRegion(null); setGroupOnly(false); setLinkedOnly(false); };

  return (
    <div className="centers-page">
      <PageHead
        title="측정 센터 지도"
        desc="랩소도·트랙맨 같은 측정 장비를 갖춘 센터와 레슨장을 지역·장비로 찾습니다. 협업 센터에서 측정한 결과는 센터 앱 연동으로 선수 프로필에 쌓입니다."
      />
      <Notice kind="info" className="centers-demo"><b>예시 데이터</b> — 지금 보이는 센터의 이름·주소·연락처·가격은 실제와 관계없습니다.</Notice>

      <div className="panel centers-filter">
        <div className="centers-filter-row">
          <label className="centers-search">
            <Icon.Search />
            <input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="센터 이름, 시·군·구로 찾기" aria-label="센터 검색" />
          </label>
          <label className="centers-toggle"><input type="checkbox" checked={groupOnly} onChange={e => setGroupOnly(e.target.checked)} />팀 단체 측정 가능</label>
          <label className="centers-toggle"><input type="checkbox" checked={linkedOnly} onChange={e => setLinkedOnly(e.target.checked)} />SPTR 연동 센터만</label>
          {hasFilter && <button type="button" className="btn ghost sm" onClick={reset}><Icon.Refresh />초기화</button>}
        </div>
        <div className="centers-equip" role="group" aria-label="보유 장비로 거르기">
          <span className="centers-equip-label">보유 장비</span>
          {EQUIPMENT_IDS.map(id => (
            <button key={id} type="button" className={`centers-equip-btn${equip.includes(id) ? " on" : ""}`} aria-pressed={equip.includes(id)} onClick={() => toggleEquip(id)}>
              {equip.includes(id) && <Icon.Check />}{EQUIPMENT[id].short}
            </button>
          ))}
        </div>
      </div>

      <div className="centers-layout">
        <div className="centers-side">
          <div className="panel centers-map">
            <div className="card-head">
              <h3>지역별 센터</h3>
              <span className="meta">{region ? <button type="button" className="link-btn" onClick={() => setRegion(null)}>전국 보기</button> : "타일을 눌러 지역 선택"}</span>
            </div>
            <div className="region-tiles" role="group" aria-label="지역 선택">
              {REGION_TILES.map(t => {
                const n = countByRegion.get(t.region) ?? 0;
                const on = region === t.region;
                return (
                  <button
                    key={t.region}
                    type="button"
                    className={`region-tile${n ? " has" : ""}${on ? " on" : ""}`}
                    style={{ gridRow: t.row + 1, gridColumn: t.col + 1 }}
                    aria-pressed={on}
                    disabled={!n && !on}
                    onClick={() => setRegion(on ? null : t.region)}
                  >
                    <span className="region-name">{t.region}</span>
                    <span className="region-count">{n}</span>
                  </button>
                );
              })}
            </div>
            <p className="centers-map-note">숫자는 지금 조건에 맞는 센터 수입니다.</p>
          </div>

          {selected && <CenterDetail c={selected} onClose={() => setSelectedId(null)} className="detail-side" />}
        </div>

        <div className="centers-main">
          <div className="centers-list-head">
            <span><b>{list.length}</b>곳{region && ` · ${region}`}</span>
            <Seg small value={sort} onChange={setSort} options={[{ value: "name", label: "이름순" }, { value: "price", label: "가격 낮은 순" }]} />
          </div>
          {list.length === 0 ? (
            <Empty>조건에 맞는 센터가 없습니다. 장비나 지역 조건을 줄여 보세요.</Empty>
          ) : (
            <ul className="centers-list">
              {list.map(c => (
                <li key={c.id}>
                  <button type="button" className={`center-card${selectedId === c.id ? " on" : ""}`} onClick={() => setSelectedId(selectedId === c.id ? null : c.id)} aria-expanded={selectedId === c.id}>
                    <div className="center-card-top">
                      <div>
                        <b className="center-name">{c.name}</b>
                        <span className="center-where">{c.region} {c.district} · {c.kind}</span>
                      </div>
                      <div className="center-badges">
                        {c.integration.connected && <span className="pill brand">SPTR 연동</span>}
                        {c.groupMeasure && <span className="pill good">단체 측정</span>}
                      </div>
                    </div>
                    <div className="center-equip">{c.equipment.map(e => <span key={e} className={`pill outline${equip.includes(e) ? " hit" : ""}`}>{EQUIPMENT[e].short}</span>)}</div>
                    <div className="center-card-foot">
                      <span>{Number.isFinite(minPrice(c)) ? `측정 1회 ${minPrice(c).toLocaleString("ko-KR")}원부터` : "가격 문의"}</span>
                      <span className="center-phone">{c.contact.phone}</span>
                    </div>
                  </button>
                  {selectedId === c.id && <CenterDetail c={c} onClose={() => setSelectedId(null)} className="detail-inline" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** 넓은 화면은 지도 아래(detail-side), 좁은 화면은 고른 카드 바로 아래(detail-inline)에 보인다 */
function CenterDetail({ c, onClose, className }: { c: MeasureCenter; onClose: () => void; className: string }) {
  return (
    <div className={`panel center-detail ${className}`}>
      <div className="card-head">
        <h3>{c.name}</h3>
        <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}><Icon.X /></button>
      </div>
      <dl className="center-facts">
        <div><dt>위치</dt><dd>{c.address}</dd></div>
        <div><dt>운영</dt><dd>{c.hours}</dd></div>
        <div><dt>연락처</dt><dd><a href={`tel:${c.contact.phone}`}>{c.contact.phone}</a>{c.contact.instagram && <> · {c.contact.instagram}</>}</dd></div>
        <div><dt>데이터</dt><dd>{c.integration.connected ? `센터 앱 연동 중 · 마지막 동기화 ${c.integration.lastSyncAt}` : "연동 전 — 측정 결과를 코치가 직접 입력"}</dd></div>
      </dl>

      <h4 className="center-sub">측정 가격</h4>
      <table className="center-prices">
        <tbody>
          {c.prices.map(p => (
            <tr key={p.label}><td>{p.label}{p.note && <span className="center-note"> · {p.note}</span>}</td><td className="num">{fmtPrice(p)}</td></tr>
          ))}
        </tbody>
      </table>

      <h4 className="center-sub">보유 장비</h4>
      <div className="center-equip">{c.equipment.map(e => <span key={e} className="pill outline">{EQUIPMENT[e].label}</span>)}</div>

      <h4 className="center-sub">측정할 수 있는 항목</h4>
      <p className="center-measures">{measurableItems(c).join(" · ")}</p>

      <div className="center-actions">
        <a className="btn" href={`tel:${c.contact.phone}`}>전화 문의</a>
      </div>
    </div>
  );
}
