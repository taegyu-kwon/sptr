import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../../lib/store";
import { evaluate, latest } from "../../lib/gpe";
import PlayerReport from "../../components/PlayerReport";
import PlayerSbiCard from "../../components/PlayerSbiCard";
import SeasonStats from "../../components/SeasonStats";
import { fmtDate } from "../../lib/format";
import { POSITION_DETAILS, handLabel, playerPositionDetail } from "../../lib/roster";
import { gamesInYear } from "../../lib/stats";
import type { ArchiveReason, BatHand, PlayerStatusKind, PositionDetail, ThrowHand } from "../../lib/types";
import { accountOfPlayer, codeState, codesOfPlayer } from "../../lib/codes";
import { STATUS_KINDS, statusLabel } from "../../lib/status";
import { todayISO } from "../../lib/schedule";
import AttendanceCard from "../../components/AttendanceCard";
import { Cell, Cells, GradeBadge, Notice, PageHead, Section } from "../../components/ui";
import MeasureForm from "../../components/MeasureForm";
import { Icon } from "../../components/icons";
import "../../styles/roster.css";
import "../../styles/measure.css";

const signed = (v: number) => `${v >= 0 ? "+" : ""}${v}`;
const GRADES = [1, 2, 3];
const THROWS: ThrowHand[] = ["우", "좌"];
const BATS: BatHand[] = ["우", "좌", "양"];
const ARCHIVE_REASONS: ArchiveReason[] = ["졸업", "이적", "기타"];

export default function PlayerDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { db, allPlayers, updatePlayer, archivePlayer, restorePlayer, addSnapshot, updateSnapshot, deleteSnapshot } = useStore();
  const player = db.players.find(p => p.id === id);

  const [edit, setEdit] = useState(false);
  const [name, setName] = useState("");
  const [positionDetail, setPositionDetail] = useState<PositionDetail>("투수");
  const [throws, setThrows] = useState<ThrowHand>("우");
  const [bats, setBats] = useState<BatHand>("우");
  const [backNumber, setBackNumber] = useState("");
  const [grade, setGrade] = useState("1");
  const [statusKind, setStatusKind] = useState<PlayerStatusKind>("정상");
  const [statusNote, setStatusNote] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [archiveReason, setArchiveReason] = useState<ArchiveReason>("졸업");
  const [restoreMsg, setRestoreMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  /** 측정 기록 폼: null 닫힘 / "add" 새 기록 / 숫자 = 수정 중인 records 위치 */
  const [measure, setMeasure] = useState<null | "add" | number>(null);
  const [recDel, setRecDel] = useState<number | null>(null);
  const [recMsg, setRecMsg] = useState<string | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!recMsg) return;
    const t = window.setTimeout(() => setRecMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [recMsg]);

  // 보관된 선수는 db.players(활동 선수)에 없다 → 안내와 복원만 보여 준다
  const archivedPlayer = !player ? allPlayers.find(p => p.id === id && p.archived) : undefined;
  if (archivedPlayer) {
    const a = archivedPlayer.archived!;
    return (
      <>
        <PageHead
          title={`${archivedPlayer.name} — 보관된 선수`}
          desc={`${archivedPlayer.grade}학년 · ${playerPositionDetail(archivedPlayer)} · 등번호 ${archivedPlayer.backNumber}번`}
          actions={
            <button type="button" className="btn ghost sm" onClick={() => nav("/c/players")}>
              <Icon.ArrowLeft />
              선수 목록
            </button>
          }
        />
        <div className="panel">
          <div className="flex gap8 wrap mb12">
            <span className="pill outline">보관 · {a.reason}</span>
            <span className="small faint">{fmtDate(a.at)} 보관</span>
          </div>
          <p className="small muted">
            보관된 선수는 명단·순위·라인업·출석에서 빠져 있고, 본인·학부모 계정으로 로그인할 수 없습니다.
            측정 기록과 지난 경기 기록은 그대로 남아 있어, 복원하면 이전 상태 그대로 다시 보입니다.
          </p>
          {restoreMsg?.kind === "error" && <Notice kind="error" className="mt12">{restoreMsg.text}</Notice>}
          <div className="flex gap12 wrap mt16">
            <button
              type="button"
              className="btn"
              onClick={() => {
                const err = restorePlayer(archivedPlayer.id);
                setRestoreMsg(err ? { kind: "error", text: err } : { kind: "ok", text: `${archivedPlayer.name} 선수를 명단에 복원했습니다.` });
              }}
            >
              명단에 복원
            </button>
            <button type="button" className="btn outline" onClick={() => nav("/c/players")}>명단으로 돌아가기</button>
          </div>
        </div>
      </>
    );
  }

  if (!player) {
    return (
      <PageHead
        title="선수를 찾을 수 없습니다"
        actions={<button type="button" className="btn secondary" onClick={() => nav("/c/players")}>목록으로</button>}
      />
    );
  }

  const s = latest(player);
  const injury = s.body.injuryHistory.trim();
  const year = new Date().getFullYear();
  const seasonGames = gamesInYear(db.games.filter(g => g.teamId === player.teamId), year);
  const hand = handLabel(player);
  const statusText = statusLabel(player, todayISO());
  const attRecords = db.attendance.filter(a => a.playerId === player.id && a.date.startsWith(String(year)));

  const teammates = db.players.filter(p => p.teamId === player.teamId);
  /** 본인·학부모 계정 상태 — 가입했으면 계정, 아니면 쓸 수 있는(없으면 가장 최근) 코드 */
  const accountRows = (["self", "parent"] as const).map(relation => {
    const account = accountOfPlayer(db.users, player.id, relation);
    const codes = codesOfPlayer(db.codes, player, relation).filter(c => !c.used);
    const code = codes.find(c => codeState(c) === "사용 가능") ?? codes.find(c => codeState(c) === "만료") ?? codes[0];
    return { relation, label: relation === "self" ? "본인 계정" : "학부모 계정", account, code };
  });

  const openEdit = () => {
    setName(player.name);
    setPositionDetail(player.positionDetail ?? (player.position === "내야수" ? "유격수" : player.position === "외야수" ? "중견수" : player.position));
    setThrows(player.throws ?? "우");
    setBats(player.bats ?? "우");
    setBackNumber(String(player.backNumber));
    setGrade(String(player.grade));
    setStatusKind(player.status?.kind ?? "정상");
    setStatusNote(player.status?.note ?? "");
    setReturnDate(player.status?.returnDate ?? "");
    setError(null);
    setConfirmDel(false);
    setEdit(true);
  };

  const closeEdit = () => {
    setEdit(false);
    setError(null);
    setConfirmDel(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const bn = backNumber.trim() === "" ? NaN : Number(backNumber);

    if (!trimmed) return setError("선수 이름을 입력하세요.");
    if (teammates.some(p => p.id !== player.id && p.name === trimmed))
      return setError("같은 이름의 선수가 이미 있습니다. 구분할 수 있게 입력하세요.");
    if (!Number.isInteger(bn) || bn < 0 || bn > 99)
      return setError("등번호는 0에서 99 사이의 숫자로 입력하세요.");
    const dup = teammates.find(p => p.id !== player.id && p.backNumber === bn);
    if (dup) return setError(`등번호 ${bn}번은 ${dup.name} 선수가 쓰고 있습니다. 다른 번호를 입력하세요.`);

    const status =
      statusKind === "정상"
        ? null
        : {
            kind: statusKind,
            ...(statusNote.trim() ? { note: statusNote.trim() } : {}),
            ...(returnDate ? { returnDate } : {}),
          };
    updatePlayer(player.id, { name: trimmed, positionDetail, throws, bats, backNumber: bn, grade: Number(grade), status });
    setError(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const openMeasure = (mode: "add" | number) => {
    setMeasure(mode);
    setRecDel(null);
    setRecMsg(null);
    // 폼이 그려진 뒤 그 위치로 내려간다
    window.setTimeout(() => measureRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const editing = typeof measure === "number" ? player.records[measure] : undefined;
  /** 최근 측정이 위로 */
  const recordRows = player.records.map((snap, index) => ({ snap, index, res: evaluate(snap) })).reverse();

  const measureSection = (
    <Section
      title="측정 기록"
      meta={`총 ${player.records.length}회 · 감독·코치가 입력, 선수는 보기만`}
      actions={
        measure === null ? (
          <button type="button" className="btn sm" onClick={() => openMeasure("add")}>
            <Icon.Plus />
            측정 기록 추가
          </button>
        ) : undefined
      }
    >
      <div ref={measureRef} className="measure-anchor" />
      {measure !== null && (measure === "add" || editing) && (
        <div className="panel">
          <div className="card-head">
            <h3>{measure === "add" ? "새 측정 기록" : `${fmtDate(editing!.date)} 기록 수정`}</h3>
            <span className="meta">신체 · 운동능력 · 실전</span>
          </div>
          <MeasureForm
            key={String(measure)}
            initial={measure === "add" ? s : editing!}
            initialDate={measure === "add" ? todayISO() : editing!.date.slice(0, 10)}
            takenDates={player.records.filter((_, i) => i !== measure).map(r => r.date.slice(0, 10))}
            hint={
              measure === "add"
                ? `직전 기록(${fmtDate(s.date)}) 값이 채워져 있습니다. 달라진 항목만 고쳐 저장하세요.`
                : "저장하면 이 날짜의 기록이 바뀌고 점수·그래프·순위에 바로 반영됩니다."
            }
            submitLabel={measure === "add" ? "측정 기록 저장" : "수정 저장"}
            onSubmit={snap => {
              if (measure === "add") addSnapshot(player.id, snap);
              else updateSnapshot(player.id, measure, snap);
              setMeasure(null);
              setRecMsg(
                measure === "add"
                  ? `${fmtDate(snap.date)} 측정 기록을 저장했습니다. 점수·성장 그래프·순위에 반영됩니다.`
                  : `${fmtDate(snap.date)} 측정 기록을 수정했습니다.`
              );
            }}
            onCancel={() => setMeasure(null)}
          />
        </div>
      )}
      {recMsg && <Notice kind="ok" className="mb12">{recMsg}</Notice>}
      <div className="panel">
        <div className="tbl-wrap">
          <table className="tbl measure-tbl">
            <thead>
              <tr>
                <th>측정일</th>
                <th className="num">키 / 몸무게</th>
                <th className="num">{s.practical.kind === "투수" ? "최고 구속" : "송구 속도"}</th>
                <th className="num">신체</th>
                <th className="num">운동능력</th>
                <th className="num">실전</th>
                <th className="num">종합</th>
                <th aria-label="수정·삭제" />
              </tr>
            </thead>
            <tbody>
              {recordRows.map(({ snap, index, res }, i) => (
                <tr key={`${index}:${snap.date}`} className={measure === index ? "on" : ""}>
                  <td>
                    {fmtDate(snap.date)}
                    {i === 0 && <span className="pill brand">최근</span>}
                  </td>
                  <td className="num">{snap.body.height} cm / {snap.body.weight} kg</td>
                  <td className="num">{snap.practical.maxVelo} km/h</td>
                  <td className="num faded">{Math.round(res.body.score)}</td>
                  <td className="num faded">{Math.round(res.athletic.score)}</td>
                  <td className="num faded">{Math.round(res.practical.score)}</td>
                  <td className="num">
                    <span className="flex gap8">
                      <b>{Math.round(res.total)}</b>
                      <GradeBadge grade={res.totalGrade} size={20} />
                    </span>
                  </td>
                  <td className="acts">
                    {recDel === index ? (
                      <>
                        <button
                          type="button"
                          className="btn danger sm"
                          onClick={() => {
                            deleteSnapshot(player.id, index);
                            setRecDel(null);
                            setMeasure(null);
                            setRecMsg(`${fmtDate(snap.date)} 측정 기록을 삭제했습니다.`);
                          }}
                        >
                          정말 삭제
                        </button>
                        <button type="button" className="btn ghost sm" onClick={() => setRecDel(null)}>취소</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn outline sm" onClick={() => openMeasure(index)}>수정</button>
                        <button
                          type="button"
                          className="btn ghost danger sm"
                          disabled={player.records.length <= 1}
                          title={player.records.length <= 1 ? "마지막 1개 기록은 삭제할 수 없습니다" : undefined}
                          onClick={() => { setRecDel(index); setMeasure(null); }}
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {player.records.length <= 1 && (
          <div className="faint small mt12">
            능력치 계산에 측정 기록이 최소 1개 필요해 마지막 기록은 삭제할 수 없습니다. 값이 틀렸으면 수정하세요.
          </div>
        )}
      </div>
    </Section>
  );

  const header = (
    <>
    {restoreMsg?.kind === "ok" && <Notice kind="ok" className="mb12">{restoreMsg.text}</Notice>}
    <div className="flex between wrap gap16">
      <div className="profile">
        <div className="profile-num">{player.backNumber}</div>
        <div>
          <div className="profile-name">{player.name}</div>
          <div className="profile-meta">
            <span>{player.grade}학년</span>
            <span className="sep" />
            <span>{playerPositionDetail(player)}{player.positionDetail && player.position !== player.positionDetail ? ` (${player.position})` : ""}</span>
            <span className="sep" />
            <span>{hand ?? "투타 미입력"}</span>
            <span className="sep" />
            <span>측정 {player.records.length}회</span>
            <span className="sep" />
            <span>최근 {fmtDate(s.date)}</span>
          </div>
          {statusText && (
            <div className="profile-chips">
              <span className="pill warn">{statusText}</span>
              {player.status?.note && player.status.kind !== "기타" && <span className="small dim">{player.status.note}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap8 wrap end">
        <button type="button" className="btn ghost sm" onClick={() => nav("/c/players")}>
          <Icon.ArrowLeft />
          선수 목록
        </button>
        <button type="button" className="btn sm" onClick={() => openMeasure("add")}>
          <Icon.Plus />
          측정 기록 추가
        </button>
        <button type="button" className="btn outline sm" onClick={() => (edit ? closeEdit() : openEdit())}>
          {edit ? "수정 닫기" : "정보 수정"}
        </button>
      </div>
    </div>
    </>
  );

  const editSection = (
    <Section title="선수 정보 수정">
      <div className="panel">
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
              <label>특이사항</label>
              <select value={statusKind} onChange={e => setStatusKind(e.target.value as PlayerStatusKind)}>
                {STATUS_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="field">
              <label>메모</label>
              <input
                value={statusNote}
                onChange={e => setStatusNote(e.target.value)}
                placeholder="예: 팔꿈치 통증, 송구 제한"
                disabled={statusKind === "정상"}
              />
            </div>
            <div className="field">
              <label>복귀 예정일</label>
              <input
                type="date"
                value={returnDate}
                onChange={e => setReturnDate(e.target.value)}
                disabled={statusKind === "정상"}
              />
            </div>
            <div className="field span-all">
              <span className="help">
                특이사항을 "정상"으로 두면 메모와 복귀 예정일은 지워집니다. 이름을 바꾸면 가입 코드에 적힌 선수 이름과 연결된 계정 이름도 함께 바뀝니다.
              </span>
            </div>
          </div>
          {error && <Notice kind="error" className="mt12">{error}</Notice>}
          {saved && <Notice kind="ok" className="mt12">수정했습니다.</Notice>}
          <div className="flex gap12 wrap mt16">
            <button className="btn" type="submit">수정 저장</button>
            <button className="btn ghost" type="button" onClick={closeEdit}>취소</button>
          </div>
        </form>

        <div className="divider" />

        <div className="flex between wrap gap12 roster-del">
          <span className="small faint">
            졸업·이적한 선수는 보관합니다. 명단·순위·라인업·출석에서 빠지고 계정 로그인이 막히지만, 측정·경기 기록은 남고 언제든 복원할 수 있습니다.
          </span>
          {confirmDel ? (
            <span className="flex gap8 wrap">
              <select
                aria-label="보관 사유"
                className="select roster-archive-reason"
                value={archiveReason}
                onChange={e => setArchiveReason(e.target.value as ArchiveReason)}
              >
                {ARCHIVE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  archivePlayer(player.id, archiveReason);
                  setEdit(false);
                  setConfirmDel(false);
                  setRestoreMsg(null);
                  window.scrollTo({ top: 0 });
                }}
              >
                보관
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirmDel(false)}>취소</button>
            </span>
          ) : (
            <button type="button" className="btn ghost danger" onClick={() => { setArchiveReason("졸업"); setConfirmDel(true); }}>
              선수 보관
            </button>
          )}
        </div>
      </div>
    </Section>
  );

  const after = (
    <>
      {edit && editSection}

      {measureSection}

      <SeasonStats player={player} games={seasonGames} year={year} />

      <Section title="출석" meta={`${year}년 · 선수 본인 체크 + 코치 수정`}>
        <AttendanceCard records={attRecords} empty="올해 출석 기록이 없습니다." />
      </Section>

      <Section title="신체 정보" meta={`측정일 ${fmtDate(s.date)}`}>
        <div className="panel sub">
          <Cells n={4}>
            <Cell
              label="나이 / 신장 / 체중"
              size="md"
              value={<>{s.body.age}<span className="unit">세</span> · {s.body.height}<span className="unit">cm</span> / {s.body.weight}<span className="unit">kg</span></>}
              sub={`골격근 ${s.body.skeletalMuscle}kg · 체지방 ${s.body.bodyFat}% · 윙스팬 ${s.body.wingspan}cm · 다리 ${s.body.legLength}cm`}
            />
            <Cell
              label="최근 1년 성장"
              size="md"
              value={
                player.records.length < 2
                  ? "-"
                  : <>{signed(s.body.heightChange1y)}<span className="unit">cm</span> / {signed(s.body.weightChange1y)}<span className="unit">kg</span></>
              }
              sub={`${player.records.length < 2 ? "측정 2회부터 표시 · " : ""}관절 가동범위 ${s.body.jointROM}/100`}
            />
            <Cell
              label={s.practical.kind === "투수" ? "최고 구속" : "송구 속도"}
              size="md"
              value={s.practical.maxVelo}
              unit="km/h"
              sub={`멀리던지기 ${s.practical.longThrow}m · 커맨드 ${s.practical.command}`}
            />
            <Cell
              label="부상/통증 이력"
              size="sm"
              value={injury || "없음"}
              sub={`에러율 ${s.practical.errorRate}%`}
            />
          </Cells>
        </div>
      </Section>

      <Section title="SBI / SMI" meta="U15 측정 지표">
        <PlayerSbiCard player={player} />
      </Section>

      <Section
        title="계정"
        meta="선수 1명당 본인 1개 · 학부모 1개"
        actions={<Link to="/c/team" className="link-btn">팀 관리에서 관리</Link>}
      >
        <div className="panel sub">
          <div className="kv">
            {accountRows.map(({ relation, label, account, code }) => {
              const state = code ? codeState(code) : null;
              return (
                <div className="kv-row" key={relation}>
                  <span className="k">{label}</span>
                  <span className="v roster-account">
                    {account ? (
                      <><span className="pill good">가입 완료</span><span>{account.email}</span></>
                    ) : code ? (
                      <>
                        <span className={`mono${state === "사용 가능" ? "" : " faint"}`}>{code.code}</span>
                        <span className={`pill ${state === "사용 가능" ? "outline" : "warn"}`}>
                          {state === "사용 가능" ? "미가입 · 사용 가능" : state}
                        </span>
                        {state === "사용 가능" && code.expiresAt && <span className="small faint">{code.expiresAt}까지</span>}
                      </>
                    ) : (
                      <span className="faint">코드 없음 · 미가입</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Section>
    </>
  );

  return <PlayerReport player={player} header={header} after={after} />;
}
