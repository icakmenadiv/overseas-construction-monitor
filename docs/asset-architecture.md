# 페이지 자산 구조

## 상태

이 문서는 운영 화면의 디자인과 기능을 유지하면서 파일명과 의존구조를 정비하기 위한 기준입니다.

- 운영 기준 브랜치: `main`
- 정비 전 백업 브랜치: `backup/pre-asset-refactor-20260903`
- 작업 브랜치: `refactor/asset-structure-20260903`
- 현재 단계: **1단계 — 핵심 CSS의 공식 이름 부여 및 호환 경로 유지**

`main`은 검증과 사용자 확인 전까지 변경하지 않습니다.

## 운영 진입 페이지

아래 세 파일만 운영 페이지 진입점으로 봅니다.

- `index.html`: 해외 건설시장 뉴스
- `projects.html`: 프로젝트 목록
- `project.html`: 프로젝트 상세

`market-preview.html`, `projects-preview.html`, `project-preview.html`은 과거 시안과 비교를 위한 역사적 페이지로 분류합니다. 파일명이 `preview`라는 이유만으로 즉시 삭제하지 않습니다.

## 현재 CSS 연결구조

운영 HTML은 현재 `brand-enhancements.css`를 직접 불러옵니다. 이 파일은 정비 기간 동안 호환 진입점으로 유지되며 다음 공식 파일을 순서대로 불러옵니다.

1. `assets/css/site-shell.css`
2. `assets/css/site-brand-motion.css`

역할은 다음과 같습니다.

| 공식 파일 | 역할 | 이전 위치 |
| --- | --- | --- |
| `assets/css/site-shell.css` | 현재 운영 화면의 전체 배경, 헤더, 상단 메뉴, 패널 등 최종 시각 오버라이드 | `actual-redesign.css` |
| `assets/css/site-brand-motion.css` | 브랜드 영역, 진입 애니메이션, 모션 감소 설정 | `brand-enhancements.css` 내부 규칙 |

아래 기존 파일은 캐시된 HTML, 북마크된 시안 페이지 및 아직 확인하지 못한 간접 참조를 보호하기 위한 **호환 래퍼**입니다.

- `actual-redesign.css`
- `brand-enhancements.css`

호환 래퍼에는 새 스타일을 추가하지 않습니다.

## 안전한 이름 변경 절차

파일 이름 변경은 항상 다음 순서로 진행합니다.

1. 기존 파일을 삭제하지 않고 공식 경로에 동일 내용을 복사합니다.
2. 기존 경로는 공식 경로를 불러오는 호환 래퍼로 전환합니다.
3. 자동 의존관계 검사를 통과시킵니다.
4. 별도 브랜치의 GitHub Pages 또는 로컬 서버에서 데스크톱·모바일 화면을 비교합니다.
5. 운영 HTML을 공식 경로로 전환합니다.
6. 일정 기간 기존 경로 요청이 없는지 확인합니다.
7. 마지막 단계에서만 호환 래퍼 삭제를 검토합니다.

파일명에 `fix`, `preview`, `fallback`, `redesign`이 들어 있다는 이유만으로 미사용 파일로 판정하지 않습니다. HTML 직접 참조, CSS `@import`, JavaScript 동적 로딩, 워크플로 및 실제 네트워크 요청을 함께 확인해야 합니다.

## JavaScript 정비 원칙

개발 메모의 운영 원칙에 따라 새 보정 스크립트를 계속 덧붙이기보다 안정화된 기능을 다음 핵심 파일에 흡수하는 방향을 우선합니다.

- `app.js`
- `projects.js`
- `project.js`
- `monitor-core-ui.js`

다만 기존 `*-fix.js`, `*-fallback.js` 파일은 역할과 호출경로가 검증되기 전까지 삭제하지 않습니다. JavaScript 통합은 CSS 이름 정비와 별도 단계로 수행합니다.

## 자동 검사

다음 명령은 운영 페이지의 직접 자산 순서, CSS 간접 import, 핵심 데이터 파일, 공식 CSS 기준 해시를 검사합니다.

```bash
node scripts/validate-page-assets.mjs
```

검사 기준은 `config/page-assets.json`에서 관리합니다. 파일을 추가·이름 변경·순서 변경할 때는 코드와 기준 파일을 같은 변경으로 갱신해야 합니다.

## 다음 단계

- **2단계:** 운영 HTML이 호환 래퍼가 아닌 공식 CSS 경로를 직접 사용하도록 전환
- **3단계:** JavaScript 보정 파일의 실제 호출 및 기능 중복 지도 작성
- **4단계:** 검증된 보정 로직을 핵심 JS에 통합하고 기존 파일은 호환 모듈로 전환
- **5단계:** 역사적 시안 파일을 별도 `legacy/` 구조로 이동하되 기존 URL 호환 유지
- **6단계:** 화면 비교와 실제 요청 기록을 거쳐 최종 미사용 파일만 삭제
