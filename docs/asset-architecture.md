# 페이지 자산 운영구조

## 운영 흐름

Agent → Google Sheets → GitHub Actions → GitHub Pages

GitHub Pages는 검색을 수행하지 않고 검증된 시트 데이터를 조회·표시합니다.

## 페이지별 자산

| 페이지 | CSS | JavaScript |
| --- | --- | --- |
| `index.html` | `assets/css/market.css` | `assets/js/market.js` |
| `projects.html` | `assets/css/projects.css` | `assets/js/projects.js` |
| `project.html` | `assets/css/project.css` | `assets/js/project.js` |

## 변경 원칙

1. 운영 HTML에는 페이지별 CSS 1개와 JavaScript 1개만 연결합니다.
2. `fix`, `preview`, `fallback` 이름의 임시 브라우저 파일을 추가하지 않습니다.
3. 프로젝트·기사 고유값은 내부 매칭에만 쓰고 화면·URL·CSV에 노출하지 않습니다.
4. CSS `@import`를 사용하지 않습니다.
5. 변경 전 `node scripts/validate-page-assets.mjs`를 실행합니다.
6. 구조개편 전 상태는 `backup/pre-asset-refactor-20260903` 브랜치에 보존합니다.
