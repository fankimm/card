# card-usages (삼성점자)

회사 법인카드 점심 결제 문자를 받아 쌓고, 월 지원 한도 대비 얼마나 썼는지 보여주는 앱.
팀 3명이 쓴다. Vercel에 올라가 있고 **main 푸시가 곧 실서비스 배포**다.

- 서비스: https://card-usages.vercel.app
- DB: 구글 스프레드시트 `card_usages_db` (Apps Script가 API 노릇)

## 어떻게 돌아가나

```
카드 결제 문자
   │  문자 전달 앱이 { test: "문자원문" } 을 POST
   ▼
POST /api/usages/ingest ─ 파싱(lib/sms-parse) ─ Apps Script ──► 시트 (결제 내역 탭)
   │                                              │
   │  결제 문자가 아니면 '무시'로 로그만            └──► 시트 (log 탭)
   ▼
GET /api/get-total-fee ──► 시트에서 전체를 받아 캐시(3분) → 정규화 → 신원별로 분리
                             myData(내 것) / publicData(이름·카드 뗀 전원)
```

화면은 `pages/index.tsx` 하나에 탭 4개(홈 / 통계 / 추천 / 비로그인 데모).

## 디렉터리

| 경로 | 역할 |
|---|---|
| `src/pages/api/usages/ingest.ts` | **문자 수신 웹훅.** 이 앱에서 유일한 쓰기 경로 |
| `src/pages/api/hello.ts` | 위의 옛 주소. 전달 앱이 다 옮기면 삭제 (아래 참고) |
| `src/pages/api/get-total-fee.ts` | 이용내역 조회. 시트 캐시도 여기 (`getData`) |
| `src/pages/api/login.ts` | 이름+카드 대조, 세션 쿠키 발급 |
| `src/pages/api/get-office-days.ts` | 좌석 시스템(pickseat)에서 출근일 |
| `src/pages/api/excluded-items.ts` | 수기 제외 항목 토글 |
| `src/pages/api/pick-seat.ts` | 좌석 자동 예약 (크론) |
| `src/pages/api/pay.js` | 급여명세서 복호화 (이 앱과 별개 유틸) |
| `src/lib/usage-filter.ts` | 코어타임·한도 판정, 취소 상쇄, 월별 추리기 |
| `src/lib/user-match.ts` | 마스킹 이름 매칭, 재발급 카드 탐지 |
| `src/lib/sms-parse.ts` | 결제 문자 파싱 |
| `src/lib/sheet-normalize.ts` | 시트가 흘리는 Date 원문 되돌리기 |
| `src/lib/session.ts`, `src/lib/auth.ts` | 서명 쿠키 세션 |
| `src/hooks/useSession.ts` | 클라이언트 로그인 상태 |
| `apps-script/Code.gs` | 시트에 붙은 Apps Script 사본 |

## 환경변수

`.env.example` 참고. 비워두면 그 기능만 꺼지고 앱은 돈다.

| 변수 | 없으면 |
|---|---|
| `API_ENDPOINT` | 조회가 503. **필수** |
| `LOG_ENDPOINT` | 문자 수신 로그를 시트에 안 남김 |
| `INGEST_SECRET` | 문자 수신 웹훅을 아무나 부를 수 있음 |
| `SESSION_SECRET` | 세션이 꺼지고 쿼리 파라미터로 신원 판단 (= 남의 데이터 조회 가능) |
| `CRON_SECRET` | `/api/pick-seat` 를 아무나 부를 수 있음 |
| `PICKSEAT_*` | `/api/pick-seat` 가 500 |
| `PAY_ALLOWED_ORIGINS` | `/api/pay` 가 같은 출처 전용 |

`SESSION_SECRET` 을 새로 켜면 기존 사용자는 한 번 다시 로그인해야 한다
(앱이 401을 받으면 알아서 로그인 화면으로 보낸다).

```bash
openssl rand -base64 32
```

## 개발

```bash
yarn dev
yarn test        # vitest, 순수 함수 위주
yarn smoke       # 배포된 앱을 헤드리스 크롬으로 훑는다 (인자로 URL 지정 가능)
```

`yarn smoke http://localhost:3000` 처럼 로컬에도 쓸 수 있다. 배포 후에는 항상 돌려볼 것.

## 문자 수신 주소 옮기기 (진행 중)

옛 주소 `/api/hello` 는 create-next-app 기본 파일에 웹훅을 얹은 게 굳은 것이다.
새 주소는 `/api/usages/ingest`. 옛 주소는 별칭으로 살아 있어 지금 당장 안 바꿔도 된다.

`INGEST_SECRET` 을 켜려면 어차피 URL에 `?key=` 를 붙여야 하니 **한 번에 같이** 바꾸면 된다.

1. 전달 앱 세 대의 URL을 아래로 교체
   ```
   https://card-usages.vercel.app/api/usages/ingest?key=<INGEST_SECRET>
   ```
2. 세 대가 다 옮겨졌는지는 **시트 log 탭 비고**로 확인한다.
   옛 주소로 들어온 요청에는 `(구주소)` 가 붙는다. 며칠 지켜봐서 안 보이면 완료.
3. `src/pages/api/hello.ts` 삭제.

`INGEST_SECRET` 은 전달 앱 URL을 먼저 고친 **뒤에** Vercel에 넣을 것. 순서가 반대면
그 사이 들어온 문자가 401로 튕긴다.

## 함정 (겪은 것들)

**Apps Script 배포**
"배포 관리 → 기존 배포 편집(연필) → 버전: 새 버전"으로 올린다.
**"새 배포"를 만들면 URL이 바뀌어** `API_ENDPOINT` / `LOG_ENDPOINT` 를 둘 다 갈아야 한다.

**시트가 날짜·시간을 Date 원문으로 흘린다**
`Wed Aug 05 2026 00:00:00 GMT+0900 (한국 표준시)` 같은 문자열이 그대로 온다.
`Code.gs` 의 `cellText` 가 막아야 하는데 그 런타임에서 `value instanceof Date` 가
거짓으로 떨어져 전 행이 샜다. 그래서 모양(`getTime` 유무)으로 판별하도록 고쳤고,
서버에도 `lib/sheet-normalize.ts` 안전망을 남겼다.

**시각 비교는 반드시 초로 바꿔서**
`'9:21:00' > '10:00:00'` 이 문자열로는 참이다. `초로()` 를 쓸 것.
파싱이 깨져 `NaN` 이 되면 조용히 전부 통과하거나 전부 탈락한다 — 실제로 한 번씩 다 겪었다.

**Vercel은 UTC**
자정+KST 값을 그냥 포맷하면 날짜가 하루 밀린다. `Asia/Seoul` 을 명시할 것.

**서버리스 캐시**
`global.cachedData` 는 인스턴스마다 다르다. TTL 3분으로 덮어놨을 뿐 신뢰하면 안 된다.
문자를 받으면 캐시에 끼워넣지 말고 만료(`global.cachedAt = 0`)시킨다.

**연말/연초**
결제 문자에는 `MM/DD` 만 온다. 12/31 문자가 1/1 새벽에 들어오면 1년 뒤가 된다.
`lib/sms-parse.ts` 의 `연도보정` 이 처리한다.
