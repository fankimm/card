/**
 * card-usages 데이터 API (Google Apps Script)
 *
 * 이 스크립트가 붙어 있는 스프레드시트가 곧 DB다.
 * Next.js 쪽에서 부르는 곳은 아래 네 가지뿐이다.
 *
 *   GET  ?                                  → 결제 내역 전체 { data: [...] }
 *   GET  ?type=excludedItems&user=이름       → 그 사람이 수기 제외한 id 목록 { data: [...] }
 *   POST ?type=exclude   body {user,itemId} → 제외 토글(있으면 해제, 없으면 등록)
 *   POST                 body {결제 한 건}    → 결제 내역 한 줄 추가
 *   POST                 body {type:'log'}  → 문자 수신 로그 한 줄 추가
 *
 * ─────────────────────────────────────────────────────────────
 * 배포할 때 주의: 반드시 "배포 관리 → 기존 배포 편집(연필) → 버전: 새 버전"으로 올릴 것.
 * "새 배포"를 만들면 URL이 바뀌어서 Vercel 환경변수를 전부 갈아야 한다.
 * ─────────────────────────────────────────────────────────────
 */

// 시트는 탭 이름 대신 gid로 찾는다. 탭 이름을 바꿔도 안 깨진다.
var USAGE_GID = 0; // 결제 내역: id, createdAt, confirmType, cardNumber, user, date, time, fee, place
var EXCLUDE_GID = 1126526954; // 수기 제외: user, itemId
var LOG_SHEET_NAME = 'log'; // 문자 수신 로그. 없으면 처음 기록할 때 자동으로 만든다.

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function sheetByGid(gid) {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) return sheets[i];
  }
  throw new Error('시트를 찾을 수 없습니다 (gid=' + gid + ')');
}

// 시트가 날짜·시간 칸을 Date로 돌려주기 때문에, 앱이 기대하는 문자열 모양으로 되돌린다.
//
// instanceof 를 쓰면 안 된다. 이 프로젝트 런타임에서는 getValues() 가 돌려주는 Date 에
// value instanceof Date 가 거짓으로 떨어져, 883행 전부가 아래 String(value) 분기로 새어
// "Wed Aug 05 2026 00:00:00 GMT+0900 (한국 표준시)" 같은 원문이 그대로 나갔다.
// (2026-08-18 확인: 버전 37까지 올려도 증상 동일. 시트 셀 자체는 2026-08-05 로 멀쩡했다.)
// 그래서 타입 대신 모양으로 판별한다 — 두 런타임 모두에서 동작한다.
function isDateValue(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.getTime === 'function' &&
    !isNaN(value.getTime())
  );
}

function cellText(value, column) {
  if (isDateValue(value)) {
    if (column === 'date')
      return Utilities.formatDate(value, 'Asia/Seoul', 'yyyy-MM-dd');
    if (column === 'time')
      return Utilities.formatDate(value, 'Asia/Seoul', 'HH:mm:ss');
    return Utilities.formatDate(value, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  }
  return String(value);
}

function rowsAsObjects(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var header = values[0].map(function (h) {
    return String(h).trim();
  });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (String(row[0]).trim() === '') continue; // 빈 줄은 건너뛴다
    var obj = {};
    for (var c = 0; c < header.length; c++) {
      if (!header[c]) continue;
      obj[header[c]] = cellText(row[c], header[c]);
    }
    out.push(obj);
  }
  return out;
}

/* ============================== 조회 ============================== */

function doGet(e) {
  var type = (e && e.parameter && e.parameter.type) || '';
  try {
    if (type === 'excludedItems') {
      return getExcludedItems(e.parameter.user);
    }
    return json({ data: rowsAsObjects(sheetByGid(USAGE_GID)) });
  } catch (err) {
    return json({ message: '실패', error: String(err) });
  }
}

function getExcludedItems(user) {
  var name = String(user || '').trim();
  var ids = rowsAsObjects(sheetByGid(EXCLUDE_GID))
    .filter(function (row) {
      return String(row.user).trim() === name;
    })
    .map(function (row) {
      return String(row.itemId).trim();
    });
  return json({ data: ids });
}

/* ============================== 기록 ============================== */

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    body = {};
  }
  var type = (e && e.parameter && e.parameter.type) || body.type || '';

  // 점심시간엔 여러 명의 결제 문자가 몇 초 간격으로 몰린다.
  // 잠그지 않으면 같은 줄에 겹쳐 쓰다가 한 건이 통째로 사라질 수 있다.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return json({ message: '실패', error: '다른 요청을 처리 중입니다' });
  }

  try {
    if (type === 'log') return appendLog(body);
    if (type === 'exclude') return toggleExclude(body);
    return appendUsage(body);
  } catch (err) {
    return json({ message: '실패', error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function appendUsage(body) {
  var sheet = sheetByGid(USAGE_GID);
  var last = sheet.getLastRow();
  var nextId = 1;
  if (last >= 2) {
    var prev = Number(sheet.getRange(last, 1).getValue());
    nextId = isNaN(prev) ? last : prev + 1;
  }
  sheet.appendRow([
    nextId,
    body.createdAt || '',
    body.confirmType || '',
    body.cardNumber || '',
    body.user || '',
    body.date || '',
    body.time || '',
    body.fee || '',
    body.place || '',
  ]);
  return json({ message: '성공', id: nextId });
}

// 같은 (사람, 항목) 줄이 있으면 지우고, 없으면 넣는다. 앱의 제외 버튼이 토글이라서다.
function toggleExclude(body) {
  var name = String(body.user || '').trim();
  var itemId = String(body.itemId || '').trim();
  if (!name || !itemId) {
    return json({ message: '실패', error: 'user, itemId 가 필요합니다' });
  }

  var sheet = sheetByGid(EXCLUDE_GID);
  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (
      String(values[r][0]).trim() === name &&
      String(values[r][1]).trim() === itemId
    ) {
      sheet.deleteRow(r + 1);
      return json({ message: '성공', action: '제외해제' });
    }
  }
  sheet.appendRow([name, itemId]);
  return json({ message: '성공', action: '제외' });
}

// Vercel 무료 티어는 점심시간대 로그가 금방 밀려 못 본다. 그래서 여기에 쌓는다.
function appendLog(body) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
    sheet.appendRow(['createdAt(KST)', '결과', '원문', '비고']);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    body.createdAt || '',
    body['결과'] || '',
    body['원문'] || '',
    body['비고'] || '',
  ]);
  return json({ message: '성공' });
}
