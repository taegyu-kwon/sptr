import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../../lib/store";
import { evaluatePlayer, latest } from "../../lib/gpe";
import { evaluatePlayerSbi, r1 } from "../../lib/sbi";
import {
  POSITION_DETAILS, ROSTER_FILTERS, handLabel, matchesFilter, nextBackNumber, playerPositionDetail,
  type RosterFilter,
} from "../../lib/roster";
import {
  battingAvg, battingTotalsByPlayer, eraOf, fmtAvg, fmtEra, fmtIp, gamesInYear, pitchingTotalsByPlayer,
} from "../../lib/stats";
import type { ArchiveReason, BatHand, PositionDetail, ThrowHand } from "../../lib/types";
import { Avatar, Cell, Cells, Empty, GradeBadge, Notice, PageHead, RiskPill, Seg } from "../../components/ui";
import { Icon } from "../../components/icons";
import { JerseyArtwork } from "../../components/ClubArtwork";
import { hasStatus, statusLabel } from "../../lib/status";
import { todayISO } from "../../lib/schedule";
import "../../styles/coach.css";
import "../../styles/roster.css";

const GRADES = [1, 2, 3];
const THROWS: ThrowHand[] = ["우", "좌"];
const BATS: BatHand[] = ["우", "좌", "양"];
const ARCHIVE_REASONS: ArchiveReason[] = ["졸업", "이적", "기타"];

/** 빈 칸은 숫자가 아닌 값으로 돌려 검증에서 걸러낸다 */
const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

type GradeFilter = "전체" | 1 | 2 | 3;
type SortKey =
  | "name" | "position" | "height" | "games" | "avg" | "hr" | "rbi"
  | "ip" | "era" | "so" | "total" | "finalR" | "risk";
type Sort = { key: SortKey; dir: "desc" | "asc" } | null;
const RISK_ORDER: Record<string, number> = { 낮음: 0, 보통: 1, 높음: 2 };

/** 정렬 가능한 머리글 — 내림차순 → 오름차순 → 해제 순으로 돈다 */
function Th({ k, sort, onSort, num: isNum, children }: {
  k: SortKey; sort: Sort; onSort: (k: SortKey) => void; num?: boolean; children: React.ReactNode;
}) {
  const on = sort?.key === k;
  const cls = ["sortable", isNum && "num", on && "sorted"].filter(Boolean).join(" ");
  return (
    <th
      className={cls}
      aria-sort={on ? (sort!.dir === "desc" ? "descending" : "ascending") : "none"}
    >
      <button type="button" className="sort-button" onClick={() => onSort(k)} aria-label={`${children} 정렬`}>
        {children}
        <span className="sort-mark" aria-hidden="true">{on ? (sort!.dir === "desc" ? "↓" : "↑") : "↕"}</span>
      </button>
    </th>
  );
}

export default function PlayersPage() {
  const { db, user, addPlayer, allPlayers, archivePlayer, restorePlayer } = useStore();
  const nav = useNavigate();
  const teamId = user!.teamId;
  /** db.players는 활동 선수만 — 보관된 선수는 allPlayers에서 따로 꺼낸다 */
  const players = db.players.filter(p => p.teamId === teamId);
  const archived = allPlayers
    .filter(p => p.teamId === teamId && p.archived)
    .sort((a, b) => b.archived!.at.localeCompare(a.archived!.at) || a.name.localeCompare(b.name, "ko"));
  const year = new Date().getFullYear();
  const seasonGames = useMemo(
    () => gamesInYear(db.games.filter(g => g.teamId === teamId), year),
    [db.games, teamId, year]
  );
  const bat = useMemo(() => battingTotalsByPlayer(seasonGames), [seasonGames]);
  const pit = useMemo(() => pitchingTotalsByPlayer(seasonGames), [seasonGames]);

  const [view, setView] = useState<"cards" | "table">("cards");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RosterFilter>("전체");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("전체");
  const [sort, setSort] = useState<Sort>(null);
  const onSort = (k: SortKey) =>
    setSort(cur =>
      cur?.key !== k ? { key: k, dir: "desc" } : cur.dir === "desc" ? { key: k, dir: "asc" } : null
    );

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [positionDetail, setPositionDetail] = useState<PositionDetail>("투수");
  const [throws, setThrows] = useState<ThrowHand>("우");
  const [bats, setBats] = useState<BatHand>("우");
  const [backNumber, setBackNumber] = useState(String(nextBackNumber(db.players, teamId)));
  const [grade, setGrade] = useState("1");
  const [age, setAge] = useState("14");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** 가입 코드는 옮겨 적어야 하므로 코치가 닫을 때까지 남긴다 */
  const [done, setDone] = useState<{ name: string; code: string } | null>(null);

  /** 보관 폼(선수·사유 선택) / 보관된 선수 목록 */
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveId, setArchiveId] = useState("");
  const [archiveReason, setArchiveReason] = useState<ArchiveReason>("졸업");
  const [showArchived, setShowArchived] = useState(false);
  const [archiveMsg, setArchiveMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const openArchive = (playerId = "") => {
    setOpen(false);
    setArchiveId(playerId);
    setArchiveReason("졸업");
    setArchiveMsg(null);
    setArchiveOpen(true);
    if (playerId) window.scrollTo({ top: 0 });
  };
  const submitArchive = (e: React.FormEvent) => {
    e.preventDefault();
    const target = players.find(p => p.id === archiveId);
    if (!target) return setArchiveMsg({ kind: "error", text: "보관할 선수를 선택하세요." });
    archivePlayer(target.id, archiveReason);
    setArchiveOpen(false);
    setShowArchived(true);
    setArchiveMsg({ kind: "ok", text: `${target.name} 선수를 보관했습니다(${archiveReason}). 명단·순위·라인업·출석에서 빠지고, 지난 경기 기록은 남습니다.` });
  };
  const doRestore = (playerId: string, playerName: string) => {
    const err = restorePlayer(playerId);
    setArchiveMsg(err ? { kind: "error", text: err } : { kind: "ok", text: `${playerName} 선수를 명단에 복원했습니다.` });
  };

  const resetForm = () => {
    setName("");
    setPositionDetail("투수");
    setThrows("우");
    setBats("우");
    setBackNumber(String(nextBackNumber(db.players, teamId)));
    setGrade("1");
    setAge("14");
    setHeight("");
    setWeight("");
    setError(null);
  };

  const toggleForm = () => {
    if (open) {
      setOpen(false);
      setError(null);
    } else {
      resetForm();
      setArchiveOpen(false);
      setOpen(true);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const bn = num(backNumber);
    const ageN = num(age);
    const heightN = num(height);
    const weightN = num(weight);

    if (!trimmed) return setError("선수 이름을 입력하세요.");
    if (players.some(p => p.name === trimmed))
      return setError("같은 이름의 선수가 이미 있습니다. 구분할 수 있게 입력하세요.");
    if (archived.some(p => p.name === trimmed))
      return setError("보관된 선수 중에 같은 이름이 있습니다. 다시 뛰는 선수라면 '보관된 선수'에서 복원하세요.");
    if (!Number.isInteger(bn) || bn < 0 || bn > 99)
      return setError("등번호는 0에서 99 사이의 숫자로 입력하세요.");
    const dup = players.find(p => p.backNumber === bn);
    if (dup) return setError(`등번호 ${bn}번은 ${dup.name} 선수가 쓰고 있습니다. 다른 번호를 입력하세요.`);
    if (!Number.isFinite(ageN) || ageN < 10 || ageN > 19)
      return setError("나이는 10세에서 19세 사이로 입력하세요.");
    if (!Number.isFinite(heightN) || heightN < 120 || heightN > 210)
      return setError("키는 120cm에서 210cm 사이로 입력하세요.");
    if (!Number.isFinite(weightN) || weightN < 25 || weightN > 150)
      return setError("몸무게는 25kg에서 150kg 사이로 입력하세요.");

    const { code } = addPlayer(teamId, {
      name: trimmed,
      positionDetail,
      throws,
      bats,
      backNumber: bn,
      grade: Number(grade),
      age: ageN,
      height: heightN,
      weight: weightN,
    });

    setOpen(false);
    resetForm();
    setDone({ name: trimmed, code });
  };

  const showPitching = filter === "투수";
  const filtered = players.filter(
    p => matchesFilter(p, filter) && (gradeFilter === "전체" || p.grade === gradeFilter)
      && (!query.trim() || p.name.includes(query.trim()) || String(p.backNumber) === query.trim().replace(/^#/, ""))
  );
  type Row = {
    p: (typeof players)[number]; r: ReturnType<typeof evaluatePlayer>; s: ReturnType<typeof latest>;
    idx: ReturnType<typeof evaluatePlayerSbi>; b: ReturnType<typeof bat.get>; pt: ReturnType<typeof pit.get>;
  };
  const sortValue = (row: Row, key: SortKey): number | string | null => {
    const { p, r, s, idx, b, pt } = row;
    switch (key) {
      case "name": return p.name;
      case "position": return playerPositionDetail(p);
      case "height": return s.body.height;
      case "games": return showPitching ? pt?.games ?? 0 : b?.games ?? 0;
      case "avg": return b && b.ab > 0 ? battingAvg(b.hits, b.ab) : null;
      case "hr": return b?.hr ?? 0;
      case "rbi": return b?.rbi ?? 0;
      case "ip": return pt?.outs ?? 0;
      case "era": return pt && pt.outs > 0 ? eraOf(pt.er, pt.ip) : null;
      case "so": return pt?.so ?? 0;
      case "total": return r.total;
      case "finalR": return idx ? idx.finalR : null;
      case "risk": return RISK_ORDER[r.injuryRisk.level] ?? null;
    }
  };
  const compareRows = (a: Row, b: Row) => {
    if (sort) {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      // 값이 없는 선수는 방향과 상관없이 맨 아래
      if (va === null && vb !== null) return 1;
      if (vb === null && va !== null) return -1;
      if (va !== null && vb !== null) {
        const c = typeof va === "string" ? va.localeCompare(String(vb), "ko") : va - (vb as number);
        if (c !== 0) return sort.dir === "desc" ? -c : c;
      }
    }
    // 기본 순서는 학년 → 등번호 (한 학년 표에서는 등번호순과 같다)
    return a.p.grade - b.p.grade || a.p.backNumber - b.p.backNumber;
  };
  /** 전체 학년이면 한 표로 합쳐 정렬이 학년 상관없는 전체 순위가 되게 한다 */
  const allGrades = gradeFilter === "전체";
  const tables = [{
    title: allGrades ? "전체 학년" : `${gradeFilter}학년`,
    rows: filtered
      .map((p): Row => ({ p, r: evaluatePlayer(p), s: latest(p), idx: evaluatePlayerSbi(p), b: bat.get(p.id), pt: pit.get(p.id) }))
      .sort(compareRows),
  }];

  const n = players.length;
  const pitchers = players.filter(p => p.position === "투수").length;
  const gradeCount = (g: number) => players.filter(p => p.grade === g).length;
  const highRisk = players.filter(p => evaluatePlayer(p).injuryRisk.level === "높음").length;
  const today = todayISO();
  const injured = players.filter(p => p.status?.kind === "재활" || p.status?.kind === "부상").length;
  const otherStatus = players.filter(hasStatus).length - injured;
  const counts: Record<RosterFilter, number> = {
    전체: n, 투수: pitchers, 야수: n - pitchers,
    내야수: players.filter(p => p.position === "내야수").length,
    외야수: players.filter(p => p.position === "외야수").length,
    포수: players.filter(p => p.position === "포수").length,
  };

  return (
    <div className="roster-page">
      <div className="editorial-label roster-eyebrow">THE ROSTER <span> / {year} SEASON</span></div>
      <PageHead
        title="가능성으로 가득한, 우리 선수단."
        desc="각자의 강점이 모여 하나의 팀이 됩니다. 선수의 기록과 컨디션을 확인하세요."
        actions={
          <>
            <button
              type="button"
              className="btn outline"
              aria-expanded={showArchived}
              onClick={() => setShowArchived(v => !v)}
            >
              보관된 선수 {archived.length}명
            </button>
            {n > 0 && (
              <button type="button" className="btn outline" onClick={() => (archiveOpen ? setArchiveOpen(false) : openArchive())}>
                {archiveOpen ? "보관 닫기" : "선수 보관"}
              </button>
            )}
            <button type="button" className={open ? "btn outline" : "btn"} onClick={toggleForm}>
              {open ? <Icon.X /> : <Icon.Plus />}
              {open ? "닫기" : "선수 등록"}
            </button>
          </>
        }
      />

      <div className="roster-overview">
        <Cells n={4}>
          <Cell label={<><Icon.Users /> 전체 선수</>} value={n} unit="명" sub={`3학년 ${gradeCount(3)} · 2학년 ${gradeCount(2)} · 1학년 ${gradeCount(1)}`} />
          <Cell label={<><Icon.Grid /> 투수 / 야수</>} value={`${pitchers} / ${n - pitchers}`} unit="명" sub={`포수 ${counts.포수} · 내야 ${counts.내야수} · 외야 ${counts.외야수}`} />
          <Cell label={<><Icon.Trophy /> {year} 시즌 경기</>} value={seasonGames.length} unit="경기" sub={`정식 ${seasonGames.filter(g => (g.type ?? "정식") === "정식").length} · 연습 ${seasonGames.filter(g => g.type === "연습").length}`} />
          <Cell label={<><Icon.Shield /> 재활 · 부상</>} value={injured} unit="명" sub={`휴식·기타 ${otherStatus} · 부상위험 높음 ${highRisk}`} />
        </Cells>
      </div>

      {done && (
        <Notice kind="ok" className="roster-code mt12">
          <div className="flex between wrap gap12">
            <div>
              {done.name} 선수를 등록했습니다. 가입 코드{" "}
              <span className="mono strong code">{done.code}</span> — 선수에게 전달하세요. 14일 안에 한 번만 쓸 수 있고,
              학부모 코드와 재발급은 <Link to="/c/team" className="roster-inline-link">팀 관리</Link>에서 합니다.
            </div>
            <button type="button" className="icon-btn sm" aria-label="알림 닫기" onClick={() => setDone(null)}>
              <Icon.X />
            </button>
          </div>
        </Notice>
      )}

      {archiveMsg && !archiveOpen && (
        <Notice kind={archiveMsg.kind} className="roster-code mt12">
          <div className="flex between wrap gap12">
            <div>{archiveMsg.text}</div>
            <button type="button" className="icon-btn sm" aria-label="알림 닫기" onClick={() => setArchiveMsg(null)}>
              <Icon.X />
            </button>
          </div>
        </Notice>
      )}

      {archiveOpen && (
        <div className="panel roster-archive-form">
          <div className="card-head">
            <h3>선수 보관</h3>
            <span className="meta">삭제하지 않고 명단에서만 뺍니다 · 언제든 복원할 수 있습니다</span>
          </div>
          <form onSubmit={submitArchive}>
            <div className="form-grid cols-2">
              <div className="field">
                <label htmlFor="archive-player">선수</label>
                <select id="archive-player" value={archiveId} onChange={e => { setArchiveId(e.target.value); setArchiveMsg(null); }}>
                  <option value="">선수 선택</option>
                  {[...players].sort((a, b) => b.grade - a.grade || a.backNumber - b.backNumber).map(p => (
                    <option key={p.id} value={p.id}>{p.grade}학년 · #{p.backNumber} {p.name} ({playerPositionDetail(p)})</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="archive-reason">사유</label>
                <select id="archive-reason" value={archiveReason} onChange={e => setArchiveReason(e.target.value as ArchiveReason)}>
                  {ARCHIVE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="field span-all">
                <span className="help">
                  보관하면 명단·순위·라인업 추천·출석에서 빠지고, 이 선수(본인·학부모) 계정은 로그인할 수 없게 됩니다.
                  측정 기록과 지난 경기 기록은 그대로 남고, 저장된 라인업에서는 자리가 비워집니다.
                </span>
              </div>
            </div>
            {archiveMsg?.kind === "error" && <Notice kind="error" className="mt12">{archiveMsg.text}</Notice>}
            <div className="flex gap12 wrap mt16">
              <button className="btn" type="submit">보관</button>
              <button className="btn ghost" type="button" onClick={() => { setArchiveOpen(false); setArchiveMsg(null); }}>취소</button>
            </div>
          </form>
        </div>
      )}

      {showArchived && (
        <div className="panel roster-archived">
          <div className="card-head">
            <div className="flex gap8"><h3>보관된 선수</h3><span className="roster-count">{archived.length}명</span></div>
            <span className="meta">복원하면 명단·순위·출석에 다시 나타나고 계정 로그인도 다시 됩니다</span>
          </div>
          {archived.length === 0 ? (
            <Empty>보관된 선수가 없습니다. 졸업·이적한 선수는 '선수 보관'으로 명단에서 뺄 수 있습니다.</Empty>
          ) : (
            <ul className="roster-archived-list">
              {archived.map(p => (
                <li key={p.id}>
                  <Avatar name={p.name} size="sm" />
                  <div className="info">
                    <b>{p.name}</b>
                    <small>#{p.backNumber} · {p.grade}학년 · {playerPositionDetail(p)}</small>
                  </div>
                  <span className="pill outline">{p.archived!.reason}</span>
                  <span className="when">{p.archived!.at} 보관</span>
                  <button type="button" className="btn outline sm" onClick={() => doRestore(p.id, p.name)} aria-label={`${p.name} 복원`}>
                    <Icon.Refresh /> 복원
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {open && (
        <div className="panel">
          <div className="card-head">
            <h3>선수 등록</h3>
            <span className="meta">등록하면 가입 코드가 함께 발급됩니다</span>
          </div>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="field">
                <label>이름</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="선수 이름" />
              </div>
              <div className="field">
                <label>포지션</label>
                <select value={positionDetail} onChange={e => setPositionDetail(e.target.value as PositionDetail)}>
                  {POSITION_DETAILS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="field">
                <label>던지는 손</label>
                <select value={throws} onChange={e => setThrows(e.target.value as ThrowHand)}>
                  {THROWS.map(h => <option key={h} value={h}>{h}투</option>)}
                </select>
              </div>
              <div className="field">
                <label>치는 방향</label>
                <select value={bats} onChange={e => setBats(e.target.value as BatHand)}>
                  {BATS.map(h => <option key={h} value={h}>{h}타</option>)}
                </select>
              </div>
              <div className="field">
                <label>등번호</label>
                <input type="number" value={backNumber} onChange={e => setBackNumber(e.target.value)} />
              </div>
              <div className="field">
                <label>학년</label>
                <select value={grade} onChange={e => setGrade(e.target.value)}>
                  {GRADES.map(g => <option key={g} value={String(g)}>{g}학년</option>)}
                </select>
              </div>
              <div className="field">
                <label>나이</label>
                <input type="number" value={age} onChange={e => setAge(e.target.value)} />
              </div>
              <div className="field">
                <label>키 (cm)</label>
                <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="170" />
              </div>
              <div className="field">
                <label>몸무게 (kg)</label>
                <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="65" />
              </div>
              <div className="field span-all">
                <span className="help">
                  이름·포지션·투타·등번호·학년과 첫 측정값(나이·키·몸무게)만 등록합니다. 나머지 측정 항목은 기본값으로
                  저장되며, 이후 측정에서 갱신합니다.
                </span>
              </div>
            </div>
            {error && <Notice kind="error" className="mt12">{error}</Notice>}
            <div className="flex gap12 wrap mt16">
              <button className="btn" type="submit">선수 등록</button>
              <button className="btn ghost" type="button" onClick={toggleForm}>닫기</button>
            </div>
          </form>
        </div>
      )}

      <div className="roster-toolbar">
        <div className="roster-toolbar-top">
          <div className="roster-section-title"><h2>전체 선수</h2><span aria-live="polite">{filtered.length}<small> / {n}명</small></span></div>
          <div className="roster-tools">
          <div className="roster-search">
            <Icon.Search />
            <input aria-label="선수 이름 또는 등번호 검색" placeholder="선수 이름 또는 등번호 검색" value={query} onChange={e => setQuery(e.target.value)} />
            {query && <button type="button" className="icon-btn sm" aria-label="검색 지우기" onClick={() => setQuery("")}><Icon.X /></button>}
          </div>
          <div className="view-switch" role="group" aria-label="선수 보기 방식">
            <button type="button" aria-label="카드 보기" aria-pressed={view === "cards"} onClick={() => setView("cards")}><Icon.Grid /></button>
            <button type="button" aria-label="표 보기" aria-pressed={view === "table"} onClick={() => setView("table")}><Icon.ListOrdered /></button>
          </div>
          </div>
        </div>
        <div className="roster-filter">
          <div className="roster-position-filter" role="group" aria-label="포지션 필터">
            <Seg
              value={filter}
              onChange={setFilter}
              options={ROSTER_FILTERS.map(f => ({
                value: f,
                label: <>{f === "야수" ? "야수 전체" : f === "내야수" ? "내야" : f === "외야수" ? "외야" : f}<span className="cnt">{counts[f]}</span></>,
              }))}
            />
          </div>
          <div className="roster-grade-filter" role="group" aria-label="학년 필터">
            <Seg
              value={String(gradeFilter)}
              onChange={v => setGradeFilter(v === "전체" ? "전체" : (Number(v) as 1 | 2 | 3))}
              options={[
                { value: "전체", label: "전체 학년" },
                ...GRADES.map(g => ({ value: String(g), label: `${g}학년` })),
              ]}
            />
          </div>
        </div>
      </div>

      <div className="roster-results-bar"><span>{gradeFilter === "전체" ? "전체 학년" : `${gradeFilter}학년`} · {filter} <b>{filtered.length}명</b></span><label>정렬 <select aria-label="선수 정렬 기준" value={sort?.key ?? "default"} onChange={e => setSort(e.target.value === "default" ? null : { key: e.target.value as SortKey, dir: e.target.value === "name" ? "asc" : "desc" })}><option value="default">학년 · 등번호순</option><option value="name">{sort?.key === "name" && sort.dir === "desc" ? "이름 역순" : "이름순"}</option><option value="total">종합 점수 {sort?.key === "total" && sort.dir === "asc" ? "낮은" : "높은"} 순</option><option value="finalR">최종 R {sort?.key === "finalR" && sort.dir === "asc" ? "낮은" : "높은"} 순</option>{sort && !["name", "total", "finalR"].includes(sort.key) && <option value={sort.key}>표 머리글 정렬</option>}</select></label></div>
      {n === 0 ? (
        <div className="panel"><Empty>등록된 선수가 없습니다. 위 '선수 등록'에서 선수를 추가하세요.</Empty></div>
      ) : view === "cards" ? (
        <div className="player-card-grid">
          {tables[0].rows.map(({ p, r, s, idx, b, pt }) => <Link className={`athlete-card tone-${p.position === "투수" ? "blue" : p.position === "내야수" ? "sage" : p.position === "외야수" ? "clay" : "purple"}`} key={p.id} to={`/c/players/${p.id}`}>
            <div className="athlete-visual"><span className="athlete-position">{playerPositionDetail(p)}</span><span className="athlete-year">{p.grade}학년</span><span className="athlete-watermark">{String(p.backNumber).padStart(2, "0")}</span><JerseyArtwork number={p.backNumber} /><span className="athlete-hand">{handLabel(p) ?? "투타 미입력"}</span></div>
            <div className="athlete-body"><div className="athlete-name"><div><span>NO. {String(p.backNumber).padStart(2, "0")}</span><h3>{p.name}</h3></div><div className="athlete-score"><span>종합</span><b>{r.total}</b><GradeBadge grade={r.totalGrade} size={20} /></div></div><div className="athlete-stats"><div><span>신장 / 체중</span><b>{s.body.height} <small>/ {s.body.weight}</small></b><em>cm / kg</em></div><div><span>{showPitching ? "시즌 ERA" : "시즌 타율"}</span><b>{showPitching ? pt && pt.outs > 0 ? fmtEra(eraOf(pt.er, pt.ip)!) : "—" : b && b.ab > 0 ? fmtAvg(battingAvg(b.hits, b.ab)!) : "—"}</b><em>{showPitching ? pt?.games ?? 0 : b?.games ?? 0}경기</em></div><div><span>최종 R</span><b>{idx ? r1(idx.finalR) : "—"}</b><em>SBI + SMI</em></div></div><div className="athlete-bottom"><span>{statusLabel(p, today) ? <span className="pill warn">{statusLabel(p, today)}</span> : <RiskPill level={r.injuryRisk.level} />}</span><span className="athlete-open"><Icon.ChevronRight /></span></div></div>
          </Link>)}
        </div>
      ) : (
        tables.filter(t => t.rows.length > 0).map(({ title, rows }) => (
          <div className="panel roster-grade" key={title}>
            <div className="card-head">
              <div className="flex gap8"><h3>{title}</h3><span className="roster-count">{rows.length}명</span></div>
              <span className="meta">{year} 시즌 · 정식 + 연습경기</span>
            </div>
            <div className="tbl-wrap" tabIndex={0} role="region" aria-label="선수 명단, 좁은 화면에서는 좌우로 스크롤">
              <table className="tbl players-tbl">
                <thead>
                  <tr>
                    <Th k="name" sort={sort} onSort={onSort}>선수</Th>
                    <Th k="position" sort={sort} onSort={onSort}>포지션 · 투타</Th>
                    <Th k="height" sort={sort} onSort={onSort}>신체</Th>
                    {showPitching ? (
                      <>
                        <Th k="games" sort={sort} onSort={onSort} num>경기</Th>
                        <Th k="ip" sort={sort} onSort={onSort} num>이닝</Th>
                        <Th k="era" sort={sort} onSort={onSort} num>ERA</Th>
                        <Th k="so" sort={sort} onSort={onSort} num>탈삼진</Th>
                      </>
                    ) : (
                      <>
                        <Th k="games" sort={sort} onSort={onSort} num>경기</Th>
                        <Th k="avg" sort={sort} onSort={onSort} num>타율</Th>
                        <Th k="hr" sort={sort} onSort={onSort} num>홈런</Th>
                        <Th k="rbi" sort={sort} onSort={onSort} num>타점</Th>
                      </>
                    )}
                    <Th k="total" sort={sort} onSort={onSort} num>종합</Th>
                    <Th k="finalR" sort={sort} onSort={onSort} num>최종 R</Th>
                    <Th k="risk" sort={sort} onSort={onSort}>리스크</Th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, r, s, idx, b, pt }) => (
                    <tr key={p.id} className="clickable" onClick={() => nav(`/c/players/${p.id}`)}>
                      <td>
                        <div className="who">
                          <Avatar name={p.name} size="sm" />
                          <div className="two">
                            <Link className="player-name-link" to={`/c/players/${p.id}`} onClick={e => e.stopPropagation()}>{p.name}</Link>
                            <small>#{p.backNumber}{allGrades && ` · ${p.grade}학년`}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="two">
                          <span>{playerPositionDetail(p)}</span>
                          <small>{handLabel(p) ?? "투타 미입력"}</small>
                        </div>
                      </td>
                      <td className="dim">{s.body.height}cm / {s.body.weight}kg</td>
                      {showPitching ? (
                        <>
                          <td className="num">{pt?.games ?? 0}</td>
                          <td className="num">{pt ? fmtIp(pt.ip) : "-"}</td>
                          <td className="num"><b>{pt && pt.outs > 0 ? fmtEra(eraOf(pt.er, pt.ip)!) : "-"}</b></td>
                          <td className="num">{pt?.so ?? 0}</td>
                        </>
                      ) : (
                        <>
                          <td className="num">{b?.games ?? 0}</td>
                          <td className="num"><b>{b && b.ab > 0 ? fmtAvg(battingAvg(b.hits, b.ab)!) : "-"}</b></td>
                          <td className="num">{b?.hr ?? 0}</td>
                          <td className="num">{b?.rbi ?? 0}</td>
                        </>
                      )}
                      <td className="num">
                        <span className="flex gap8">
                          <b>{r.total}</b>
                          <GradeBadge grade={r.totalGrade} size={20} />
                        </span>
                      </td>
                      <td className="num">
                        <span className="brand-text strong">{idx ? r1(idx.finalR) : "-"}</span>
                      </td>
                      <td>
                        <span className="roster-flags">
                          <RiskPill level={r.injuryRisk.level} />
                          {statusLabel(p, today) && (
                            <span className="pill warn" title={p.status?.note}>{statusLabel(p, today)}</span>
                          )}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn ghost sm"
                          aria-label={`${p.name} 보관`}
                          onClick={e => { e.stopPropagation(); openArchive(p.id); }}
                        >
                          보관
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="roster-table-foot"><span><Icon.Info /> 선수 이름을 선택하면 상세 기록을 볼 수 있어요.</span><span>머리글을 눌러 정렬 <span aria-hidden="true">↕</span></span></div>
          </div>
        ))
      )}
      {n > 0 && filtered.length === 0 && (
        <div className="panel roster-empty"><Icon.Search /><h3>검색 결과가 없습니다</h3><p>선수 이름이나 등번호, 선택한 필터를 확인해 주세요.</p><button type="button" className="btn outline" onClick={() => { setQuery(""); setFilter("전체"); setGradeFilter("전체"); }}>검색·필터 초기화</button></div>
      )}
    </div>
  );
}
