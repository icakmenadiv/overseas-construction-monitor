# 해외 건설시장 모니터링

에이전트가 조사·검증한 해외 건설·인프라 정보를 Google Sheets에 저장하고, GitHub Pages에서 조회하는 대시보드입니다.

## 운영 구조

**Agent → Google Sheets → GitHub Actions → GitHub Pages**

- **Agent**: 외부 정보 검색, 사실확인, 분류 및 요약
- **Google Sheets**: 운영 데이터 원본 저장
- **GitHub Actions**: 허용된 시트 데이터를 정적 JSON으로 동기화
- **GitHub Pages**: 검색, 필터, 정렬 및 상세정보 표시

이 저장소는 외부 기사 검색이나 AI 판단을 수행하지 않습니다. 검증이 끝난 결과를 화면에 제공하는 역할만 담당합니다.

## 운영 데이터

| 용도 | Google Sheets 탭 | 캐시 파일 |
| --- | --- | --- |
| 건설시장 뉴스 | `결과` | `data/articles.json` |
| 프로젝트 목록 | `프로젝트` | `data/projects.json` |
| 동기화 상태 | - | `data/meta.json` |

운영 보조 탭은 페이지 데이터 원본으로 사용하지 않습니다.

## 주요 화면

- `index.html`: 건설시장 뉴스 목록
- `projects.html`: 프로젝트 목록
- `project.html`: 프로젝트 상세 및 관련 기사

## 핵심 운영 파일

- `app.js`, `projects.js`, `project.js`: 화면별 데이터 처리
- `styles.css` 및 화면별 CSS: 페이지 디자인
- `scripts/sync-sheet-cache.mjs`: Google Sheets 데이터를 정적 캐시로 변환
- `.github/workflows/sync-sheet-cache.yml`: 캐시 자동 동기화
- `data/`: GitHub Pages가 읽는 정적 데이터

관심도와 조회수 기능은 각각 전용 브라우저 모듈, Cloudflare Worker 및 동기화 워크플로로 분리하여 운영합니다.

## 배포 원칙

1. 운영 데이터는 Google Sheets에서 관리합니다.
2. GitHub Actions가 `결과`와 `프로젝트` 탭을 캐시 파일로 갱신합니다.
3. GitHub Pages는 캐시를 우선 사용하고, 캐시가 없을 때만 원본 시트를 확인합니다.
4. 페이지 수정 시 운영 화면에서 실제로 불러오는 파일만 유지합니다.
