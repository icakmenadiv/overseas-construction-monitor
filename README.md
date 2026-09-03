# 해외 건설시장 모니터링

에이전트가 조사·검증한 해외 건설·인프라 정보를 Google Sheets에 저장하고, GitHub Pages에서 조회하는 대시보드입니다.

## 운영 구조

**Agent → Google Sheets → GitHub Actions → GitHub Pages**

- **Agent**: 외부 정보 검색, 사실확인, 분류 및 요약
- **Google Sheets**: 운영 데이터 원본 저장
- **GitHub Actions**: 허용된 시트 데이터를 정적 JSON으로 동기화하고 페이지 자산을 검증
- **GitHub Pages**: 검색, 필터, 정렬 및 상세정보 표시

이 저장소는 외부 기사 검색이나 AI 판단을 수행하지 않습니다. 검증이 끝난 결과를 화면에 제공하는 역할만 담당합니다.

## 운영 페이지

| 화면 | HTML | CSS | JavaScript |
| --- | --- | --- | --- |
| 시장 모니터링 | `index.html` | `assets/css/market.css` | `assets/js/market.js` |
| 프로젝트 목록 | `projects.html` | `assets/css/projects.css` | `assets/js/projects.js` |
| 프로젝트 상세 | `project.html` | `assets/css/project.css` | `assets/js/project.js` |

## 운영 데이터

- `data/articles.json`: 결과 탭 기반 기사 데이터
- `data/projects.json`: 프로젝트 탭 기반 프로젝트 데이터
- `data/meta.json`: 동기화 메타데이터
- `data/view-counts.json`: 조회수 캐시

## 개발 원칙

- 루트에 임시 CSS·JavaScript를 추가하지 않습니다.
- 기능은 페이지별 번들에 통합합니다.
- 운영 페이지의 자산 연결은 `config/page-assets.json`으로 관리합니다.
- 프로젝트·기사 고유값은 내부 매칭에만 사용하고 공개 URL과 화면에 노출하지 않습니다.
- 자산 구조 검사는 `node scripts/validate-page-assets.mjs`로 수행합니다.

상세 기준은 `docs/asset-architecture.md`를 참고합니다.
