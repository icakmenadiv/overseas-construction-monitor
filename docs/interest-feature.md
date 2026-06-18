# 관심 하트 기능 운영 메모

## 동작 방식

- 기존 시장 모니터링 목록에 `♡/♥` 관심 버튼을 자동 삽입합니다.
- 프로젝트 상세 페이지에도 프로젝트 단위 관심 버튼과 연결 기사별 관심 버튼을 표시합니다.
- 같은 브라우저에서는 `localStorage`의 익명 visitorId로 내가 누른 상태를 기억합니다.
- 한 번 누르면 관심 등록, 다시 누르면 관심 취소입니다.
- `interest-config.js`의 `window.INTEREST_API_ENDPOINT`가 비어 있으면 브라우저 안에서만 임시 카운트가 유지됩니다.
- Cloudflare Worker URL을 넣으면 기사별·프로젝트별 전체 관심 수가 서버에 누적됩니다.

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

## Cloudflare Worker 연결 절차

1. Cloudflare D1 데이터베이스를 생성합니다.
2. `workers/interest-schema.sql`을 D1에 실행합니다.
3. `workers/interest-worker.js`를 Cloudflare Worker로 배포합니다.
4. Worker에 D1 binding 이름을 `DB`로 연결합니다.
5. 배포된 Worker URL을 `interest-config.js`에 입력합니다.

예시:

```js
window.INTEREST_API_ENDPOINT = "https://icak-interest-api.your-subdomain.workers.dev";
```

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
