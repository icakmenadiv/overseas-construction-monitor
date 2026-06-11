# 해외 건설시장 모니터링

GitHub Pages에서 배포할 수 있는 정적 웹 대시보드입니다. 외부 공개용 Google Sheets인 `건설시장 뉴스 조회용` 데이터를 불러와 기간, 키워드, 지역, 국가, 섹터별로 조회합니다.

## 주요 기능

- 📊 **실시간 데이터 동기화**: Google Sheets에서 자동으로 데이터를 불러옵니다.
- 🔍 **다양한 필터링**: 키워드, 날짜 범위, 지역, 국가, 섹터로 검색 가능합니다.
- 💾 **필터 상태 저장**: 사용자의 필터 설정이 로컬스토리지에 저장되어 다음 방문시 유지됩니다.
- 🔄 **수동 새로 고침**: 언제든지 데이터를 새로 고칠 수 있습니다.
- 📥 **CSV 내보내기**: 필터링된 결과를 CSV 파일로 다운로드할 수 있습니다.
- 📱 **반응형 디자인**: 모바일, 태블릿, 데스크톱 모든 기기에서 최적화되어 있습니다.

## 파일 구성

- `index.html`: 화면 구조
- `styles.css`: 디자인 및 반응형 스타일
- `app.js`: Google Sheets 데이터 연동, 필터, 정렬, 상세 보기 로직
- `assets/logo.png`: 해외건설협회 로고 자리 표시자

## Google Sheets 연결

`app.js` 상단의 `CONFIG` 값을 수정합니다.

```js
const CONFIG = {
  SHEET_API_URL:
    "https://docs.google.com/spreadsheets/d/1jhZEUaPWy5v2rwf2J-XMXaoDNb70dA8964LISJRLjT0/gviz/tq?tqx=out:json&gid=1307021607",
  SHEET_VIEW_URL:
    "https://docs.google.com/spreadsheets/d/1jhZEUaPWy5v2rwf2J-XMXaoDNb70dA8964LISJRLjT0/edit?gid=1307021607#gid=1307021607",
  DEFAULT_PERIOD_DAYS: 30,
};
```

### SHEET_API_URL

기본값은 Google Visualization API 형식입니다.

```text
https://docs.google.com/spreadsheets/d/{스프레드시트_ID}/gviz/tq?tqx=out:json&gid={시트_gid}
```

CSV 게시 URL을 사용하는 경우 아래 형식으로 바꿀 수 있습니다.

```text
https://docs.google.com/spreadsheets/d/e/{게시_ID}/pub?gid={시트_gid}&single=true&output=csv
```

### SHEET_VIEW_URL

상단과 하단의 `시트 보기` 버튼이 열 링크입니다. 사용자가 볼 수 있는 원본 Google Sheets 링크를 넣습니다.

## Google Sheets 공개 설정

1. Google Sheets에서 `공유`를 클릭합니다.
2. 외부 공개 조회가 필요하면 링크가 있는 사용자가 볼 수 있도록 권한을 설정합니다.
3. CSV 방식으로 쓰려면 `파일 > 공유 > 웹에 게시`에서 해당 시트를 CSV로 게시합니다.
4. 공개 범위가 제한되어 있으면 GitHub Pages에서 데이터를 불러오지 못할 수 있습니다.

## 데이터 컬럼명

시트의 첫 행에는 아래 컬럼명을 유지해야 합니다.

- 원문게재일
- 기사수집일
- 지역
- 국가
- 섹터
- 주제
- 제목(한글)
- 제목(원문)
- 내용
- 출처언어
- 출처링크

`중요도`, `담당자 활용시 체크` 컬럼은 이 대시보드에서 사용하지 않습니다.

## GitHub Pages 배포

1. 이 파일들을 GitHub 저장소의 루트에 업로드합니다.
2. GitHub 저장소에서 `Settings > Pages`로 이동합니다.
3. `Build and deployment`의 Source를 `Deploy from a branch`로 설정합니다.
4. Branch를 `main` 또는 사용하는 기본 브랜치로 선택하고 `/root`를 선택합니다.
5. 저장 후 제공되는 GitHub Pages URL로 접속합니다.

## 로고 교체

실제 해외건설협회 로고 파일을 `assets/logo.png`로 교체하면 자동 표시됩니다. 파일이 없거나 로딩되지 않으면 텍스트 `ICAK`이 대체 표시됩니다.

## 개발 기능 및 기술

### 성능 최적화
- **Debouncing**: 키워드 검색 입력시 300ms 딜레이를 두어 불필요한 렌더링을 줄였습니다.
- **효율적인 필터링**: 단일 패스로 모든 필터를 적용합니다.
- **메모리 관리**: 확장된 행의 ID만 저장하고 필요시에만 렌더링합니다.

### 에러 처리
- **재시도 로직**: API 요청 실패시 지수 백오프로 자동 재시도합니다.
- **사용자 피드백**: 모든 상태(로딩, 성공, 실패)에 대한 명확한 메시지를 표시합니다.

### 접근성 (Accessibility)
- ARIA 라벨 및 역할 사용
- 시맨틱 HTML 구조
- 키보드 네비게이션 지원
- 명확한 포커스 표시

### 보안
- XSS 방지를 위한 HTML 이스케이핑
- 외부 링크에 `rel="noreferrer"` 설정
- 로컬 스토리지 사용시 에러 핸들링

## 라이선스

MIT