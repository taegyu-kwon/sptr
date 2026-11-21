import type { Player, SignupCode, User } from "./types";
import { addDays, todayISO } from "./schedule";

/** 가입 코드 유효 기간(일) — 발급일 포함 14일 뒤 자정까지 */
export const CODE_VALID_DAYS = 14;

/** 헷갈리는 글자(0·O, 1·I·L)를 뺀 글자표 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomChunk(len: number): string {
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, n => ALPHABET[n % ALPHABET.length]).join("");
}

/** SPTR-XXXX-XXXX 형식의 무작위 코드. 이미 있는 코드와 겹치지 않게 뽑는다 */
export function randomCode(existing: SignupCode[]): string {
  const used = new Set(existing.map(c => c.code));
  for (;;) {
    const code = `SPTR-${randomChunk(4)}-${randomChunk(4)}`;
    if (!used.has(code)) return code;
  }
}

/** 오늘 발급하는 코드의 발급일·만료일 */
export function newCodeDates(): { issuedAt: string; expiresAt: string } {
  const issuedAt = todayISO();
  return { issuedAt, expiresAt: addDays(issuedAt, CODE_VALID_DAYS) };
}

export type CodeState = "사용 가능" | "사용됨" | "폐기" | "만료";

/** 예전 코드(만료일 없음)는 만료되지 않는 것으로 본다 */
export function codeState(c: SignupCode, today = todayISO()): CodeState {
  if (c.used) return "사용됨";
  if (c.revoked) return "폐기";
  if (c.expiresAt && today > c.expiresAt) return "만료";
  return "사용 가능";
}

export const relationOf = (c: SignupCode): "self" | "parent" => c.relation ?? "self";

/** 코드가 가리키는 선수 — 새 코드는 playerId, 예전 코드는 이름으로 연결돼 있다 */
export function playerOfCode(c: SignupCode, players: Player[]): Player | undefined {
  if (c.role !== "player") return undefined;
  if (c.playerId) return players.find(p => p.id === c.playerId);
  return players.find(p => p.teamId === c.teamId && p.name === c.playerName);
}

/** 한 선수의 본인/학부모 코드 전부(폐기·만료·사용 포함) */
export function codesOfPlayer(codes: SignupCode[], player: Player, relation: "self" | "parent"): SignupCode[] {
  return codes.filter(
    c =>
      c.role === "player" && relationOf(c) === relation &&
      (c.playerId ? c.playerId === player.id : c.teamId === player.teamId && c.playerName === player.name)
  );
}

/** 선수에 연결된 본인/학부모 계정 */
export function accountOfPlayer(users: User[], playerId: string, relation: "self" | "parent"): User | undefined {
  return users.find(u => u.playerId === playerId && (relation === "parent" ? u.relation === "parent" : u.relation !== "parent"));
}

export interface CodeCheck {
  /** 가입할 수 없으면 사유 문구 */
  error: string | null;
  code?: SignupCode;
  player?: Player;
}

/** 가입 화면·가입 처리 공통 검사 — 왜 안 되는지 구체적으로 알려 준다 */
export function checkSignupCode(raw: string, codes: SignupCode[], players: Player[], users: User[]): CodeCheck {
  const c = codes.find(x => x.code === raw.trim().toUpperCase());
  if (!c) return { error: "등록되지 않은 가입 코드입니다. 코치에게 받은 코드를 다시 확인하세요." };
  const state = codeState(c);
  if (state === "사용됨") return { error: "이미 가입에 사용된 코드입니다. 가입 코드는 한 번만 쓸 수 있습니다. 로그인하거나 코치에게 새 코드를 요청하세요.", code: c };
  if (state === "폐기") return { error: "폐기된 가입 코드입니다. 코치가 새 코드를 발급했을 수 있으니 최신 코드를 확인하세요.", code: c };
  if (state === "만료") return { error: `만료된 가입 코드입니다(만료일 ${c.expiresAt}). 코치에게 재발급을 요청하세요.`, code: c };
  if (c.role !== "player") return { error: null, code: c };
  const player = playerOfCode(c, players);
  if (!player) return { error: "코드에 연결된 선수 정보를 찾을 수 없습니다. 코치에게 문의하세요.", code: c };
  if (player.archived) return { error: "보관된 선수의 가입 코드입니다. 코치에게 문의하세요.", code: c, player };
  const rel = relationOf(c);
  if (accountOfPlayer(users, player.id, rel))
    return { error: `${player.name} 선수의 ${rel === "parent" ? "학부모" : "본인"} 계정이 이미 있습니다. 계정은 선수 1명당 본인 1개·학부모 1개입니다.`, code: c, player };
  return { error: null, code: c, player };
}
