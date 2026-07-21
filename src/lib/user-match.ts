// 문자 발신처 변경으로 이름이 마스킹되어 들어오는 경우(김지환 → 김*환)가 있어
// 카드 뒷 4자리를 주키로 쓰고, 이름은 마스킹 허용 패턴 매칭으로 방어한다.

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
  card?: string
) => {
  const nameOk = isMaskedNameMatch(item.user, name);
  if (!card) return nameOk;
  return String(item.cardNumber || '').trim() === String(card).trim() && nameOk;
};
