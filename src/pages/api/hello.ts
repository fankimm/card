// 예전 문자 수신 주소. create-next-app 기본 파일에 웹훅을 얹은 게 그대로 굳었다.
//
// 문자 전달 앱 세 대가 아직 이 주소를 보고 있어서 남겨 둔다. 여기로 들어온 요청은
// 로그 탭 비고에 '(구주소)' 가 붙으므로, 셋 다 /api/usages/ingest 로 넘어간 게
// 확인되면 이 파일을 지우면 된다.
export { default } from './usages/ingest';
