// 문자 발신처 변경으로 이름이 마스킹되어 들어오는 경우(김지환 → 김*환)가 있어
// 카드 뒷 4자리를 주키로 쓰고, 이름은 마스킹 허용 패턴 매칭으로 방어한다.
//
// 카드는 재발급(유효기간 만료 등)으로 뒷 4자리가 바뀔 수 있어 한 사람이 여러 개를 가진다.
// 그래서 카드 값은 어디서든 콤마로 이어붙인 문자열('5678,1234')로 주고받는다. 맨 앞이 현재 카드.

export type CardInput = string | string[] | null | undefined;

// 콤마로 이어붙인 카드 값을 배열로. 공백·중복은 정리하고 순서는 유지한다.
export const 카드목록파싱 = (card: CardInput): string[] => {
  const raw = Array.isArray(card) ? card : String(card ?? '').split(',');
  const out: string[] = [];
  for (const c of raw) {
    const v = c.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
};

// 두 이름이 같은 사람인지 비교. '*' 위치는 어느 쪽이든 와일드카드로 취급.
export const isMaskedNameMatch = (a?: string, b?: string) => {
  const x = (a || '').trim();
  const y = (b || '').trim();
  if (!x || !y || x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== '*' && y[i] !== '*' && x[i] !== y[i]) return false;
  }
  return true;
};

// 내역 한 건이 로그인 사용자(이름 + 카드 뒷 4자리)의 것인지 판별.
// card가 없으면(구버전 호출) 이름 패턴 매칭만으로 동작한다.
export const isSameUser = (
  item: { user?: string; cardNumber?: string },
  name?: string,
  card?: CardInput
) => {
  const nameOk = isMaskedNameMatch(item.user, name);
  const cards = 카드목록파싱(card);
  if (cards.length === 0) return nameOk;
  return nameOk && cards.includes(String(item.cardNumber || '').trim());
};

// 카드를 재발급받으면 같은 사람인데 뒷 4자리가 달라져 과거 내역이 통째로 안 잡힌다.
// 이름이 (마스킹 감안) 같으면서 쓰인 기간이 내 카드와 겹치지 않는 번호를 같은 사람의 옛 카드로 본다.
// 기간이 겹치면 동명이인일 수 있으므로 넣지 않는다.
// 내 카드로 긁은 기록이 아직 하나도 없으면(재발급 직후) 후보가 딱 하나일 때만 인정한다.
export const 재발급카드찾기 = (
  all: { user?: string; cardNumber?: string; date?: string }[],
  name: string,
  card: CardInput
): string[] => {
  const 내카드 = 카드목록파싱(card);
  if (!name?.trim() || 내카드.length === 0) return [];

  // 이름이 맞는 내역을 카드별로 모아 사용 기간을 잰다.
  const 기간 = new Map<string, { from: string; to: string }>();
  for (const i of all || []) {
    if (!isMaskedNameMatch(i.user, name)) continue;
    const no = String(i.cardNumber || '').trim();
    const d = String(i.date || '').trim();
    if (!no || !d) continue;
    const cur = 기간.get(no);
    if (!cur) 기간.set(no, { from: d, to: d });
    else {
      if (d < cur.from) cur.from = d;
      if (d > cur.to) cur.to = d;
    }
  }

  const 후보 = Array.from(기간.keys()).filter((no) => !내카드.includes(no));
  if (후보.length === 0) return [];

  const 내기간 = 내카드
    .map((no) => 기간.get(no))
    .filter(Boolean) as { from: string; to: string }[];

  if (내기간.length === 0) {
    // 새 카드로 긁은 게 아직 없다 — 이름이 맞는 카드가 딱 하나면 그게 직전 카드다.
    return 후보.length === 1 ? 후보 : [];
  }

  const 안겹침 = (a: { from: string; to: string }, b: { from: string; to: string }) =>
    a.to < b.from || a.from > b.to;

  const 남은후보 = 후보
    .map((no) => ({ no, ...기간.get(no)! }))
    .filter((c) => 내기간.every((m) => 안겹침(c, m)));

  // 후보끼리 기간이 겹치면 둘 중 어느 쪽이 내 옛 카드인지 알 수 없다(동명이인일 수 있다).
  // 이럴 땐 자동으로 넣지 않고 설정에서 직접 등록하게 둔다.
  for (let i = 0; i < 남은후보.length; i++) {
    for (let j = i + 1; j < 남은후보.length; j++) {
      if (!안겹침(남은후보[i], 남은후보[j])) return [];
    }
  }
  return 남은후보.map((c) => c.no);
};
