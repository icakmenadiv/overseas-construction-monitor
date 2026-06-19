# 해외 건설시장 Daily Brief 자동 메일 발송 설정

이 폴더의 `daily-market-brief.gs`는 Google Sheets의 시장 모니터링 데이터를 읽어 최근 기사수집일 기준 중요도순 상위 10건을 HTML 메일로 자동 발송하는 Google Apps Script 코드입니다.

## 발송 기준

- 데이터 원천: Google Sheets `시장 모니터링` 데이터 시트
- 기준일: 시트 내 `기사수집일` 중 가장 최근 날짜
- 대상: 해당 기사수집일과 같은 날짜의 기사
- 정렬: 중요도 점수 또는 중요도 텍스트 기준 내림차순, 동점 시 원문게재일 최신순
- 발송 건수: 상위 10건
- 포함 링크: 원문 링크, 시장 모니터링 대시보드 링크

## 설치 방법

1. Google Sheets를 엽니다.
2. 상단 메뉴에서 `확장 프로그램 > Apps Script`를 선택합니다.
3. 기본 `Code.gs` 내용을 삭제합니다.
4. `daily-market-brief.gs` 전체 내용을 붙여넣습니다.
5. `CONFIG` 값을 확인합니다.
   - `RECIPIENTS`: 실제 수신자 이메일
   - `CC`, `BCC`: 필요 시 참조/숨은참조
   - `TRIGGER_HOUR`: 자동 발송 시간. 기본값은 한국시간 오전 8시입니다.
6. 저장합니다.

## 테스트 발송

Apps Script 편집기에서 함수 목록 중 `sendTestDailyMarketBrief`를 선택하고 실행합니다.

처음 실행할 때 Google 권한 승인이 필요합니다. 권한 승인 후 수신 메일함에서 디자인, 링크, 기사 목록을 확인합니다.

## 자동 발송 설정

테스트가 정상이라면 함수 목록에서 `createDailyMarketBriefTrigger`를 선택하고 1회 실행합니다.

이후 매일 `CONFIG.TRIGGER_HOUR`에 맞춰 자동 발송됩니다.

## 자동 발송 중지

함수 목록에서 `deleteDailyMarketBriefTriggers`를 실행하면 자동 발송 트리거가 삭제됩니다.

## 미리보기

`previewDailyMarketBriefHtml` 함수를 실행하면 현재 기준으로 생성되는 HTML 본문을 문자열로 확인할 수 있습니다.

## 운영 메모

- “최근 24시간”이 아니라 “시트에 입력된 가장 최근 기사수집일”을 기준으로 하므로, 주말·휴일·시트 갱신 지연 시에도 누락 가능성이 낮습니다.
- HTML 메일은 대시보드 색상과 유사한 파란색 계열 카드형 디자인으로 구성했습니다.
- AI 기반 분류·요약은 참고용이라는 안내 문구를 메일 하단에 포함했습니다.
