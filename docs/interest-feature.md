# 관심 하트 기능 운영 메모

## 현재 운영 단계

관심 하트 기능은 두 단계로 운영합니다.

1. 미리보기 단계
   - `index.html?interest=1`에서만 하트가 보입니다.
   - `interest-config.js`의 `window.INTEREST_FEATURE_ENABLED = false`입니다.
   - `window.INTEREST_API_ENDPOINT = ""`이므로 같은 브라우저 안에서만 임시 카운트가 유지됩니다.

2. 실제 누적 단계
   - Cloudflare Worker + D1을 배포합니다.
   - 배포된 Worker URL을 `interest-config.js`에 넣습니다.
   - `window.INTEREST_FEATURE_ENABLED = true`로 바꾸면 일반 URL에서도 하트가 보이고 전체 관심 수가 누적됩니다.

## 안전 적용 원칙

운영 페이지 장애를 막기 위해 서버 누적 전까지 기본값은 꺼둡니다.

- 일반 접속에서는 하트 기능이 실행되지 않습니다.
- 미리보기는 URL 뒤에 `?interest=1`을 붙여 확인합니다.

예시:

```text
index.html?interest=1
project.html?name=프로젝트명&country=국가&sector=섹터&interest=1
```

UI와 데이터 로딩이 모두 안정적으로 확인된 뒤에만 `window.INTEREST_FEATURE_ENABLED = true`로 전환합니다.

## 동작 방식

- 기존 시장 모니터링 목록에 `♡/♥` 관심 버튼을 표시합니다.
- 프로젝트 상세 페이지에도 프로젝트 단위 관심 버튼과 연결 기사별 관심 버튼을 표시합니다.
- 같은 브라우저에서는 `localStorage`의 익명 visitorId로 내가 누른 상태를 기억합니다.
- 한 번 누르면 관심 등록, 다시 누르면 관심 취소입니다.
- `interest-config.js`의 `window.INTEREST_API_ENDPOINT`가 비어 있으면 브라우저 안에서만 임시 카운트가 유지됩니다.
- Cloudflare Worker URL을 넣으면 기사별·프로젝트별 전체 관심 수가 서버에 누적됩니다.

## 실제 누적 적용 절차

### 1. Cloudflare D1 데이터베이스 생성

Cloudflare Dashboard 또는 Wrangler CLI에서 D1 데이터베이스를 생성합니다.

권장 이름:

```text
icak-interest-db
```

### 2. `workers/wrangler.toml`의 database_id 교체

`workers/wrangler.toml`에서 아래 값을 실제 D1 database_id로 바꿉니다.

```toml
database_id = "REPLACE_WITH_D1_DATABASE_ID"
```

### 3. D1 스키마 적용

`workers/interest-schema.sql`을 D1에 적용합니다.

Wrangler CLI 기준 예시:

```bash
cd workers
npx wrangler d1 execute icak-interest-db --file=./interest-schema.sql
```

### 4. Worker 배포

```bash
cd workers
npx wrangler deploy
```

배포 후 예시 URL:

```text
https://icak-interest-api.<cloudflare-subdomain>.workers.dev
```

### 5. 프론트엔드 운영 전환

`interest-config.js`를 아래처럼 바꿉니다.

```js
window.INTEREST_FEATURE_ENABLED = true;
window.INTEREST_API_ENDPOINT = "https://icak-interest-api.<cloudflare-subdomain>.workers.dev";
```

이후 일반 URL에서도 하트가 표시되고, 관심 수가 전체 사용자 기준으로 누적됩니다.

## 프로젝트 전체 관심 수 산식

프로젝트 상세 페이지의 `프로젝트 관심` 총합은 다음 기준으로 표시합니다.

```text
프로젝트 전체 관심 수 = 프로젝트 직접 관심 수 + 해당 프로젝트에 연결된 기사 관심 수 합계
```

예시:

```text
프로젝트 직접 관심 2
연결 기사 A 관심 3
연결 기사 B 관심 1
연결 기사 C 관심 0
→ 프로젝트 전체 관심 수 6
```

프로젝트 직접 관심은 해당 프로젝트 자체를 후속 추적 대상으로 표시하는 신호입니다. 연결 기사 관심은 프로젝트 상세 페이지에 표시되는 관련 기사 각각의 관심 수입니다.

## 한계

로그인 없는 방식이므로 완전한 1인 1표가 아닙니다.

다음 경우에는 같은 사용자가 다시 누를 수 있습니다.

- 다른 기기 사용
- 다른 브라우저 사용
- 시크릿 모드 사용
- 브라우저 localStorage 삭제

따라서 이 수치는 투표 결과가 아니라 후속 추적 우선순위 판단용 참고 지표로 사용하는 것이 적합합니다.

## API

### GET /counts

```text
/counts?ids=article-a,article-b,project-a&visitorId=<anonymous-visitor-id>
```

응답:

```json
{
  "items": [
    { "articleId": "article-a", "count": 3, "active": true },
    { "articleId": "project-a", "count": 2, "active": false }
  ]
}
```

### POST /toggle

```json
{
  "articleId": "article-a",
  "articleTitle": "기사 제목 또는 프로젝트명",
  "articleUrl": "https://example.com/article",
  "visitorId": "anonymous-visitor-id"
}
```

응답:

```json
{
  "articleId": "article-a",
  "active": true,
  "count": 4
}
```
