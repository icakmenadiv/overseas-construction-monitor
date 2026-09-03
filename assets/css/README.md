# Canonical CSS assets

이 폴더는 운영 화면에서 장기적으로 사용할 공식 CSS 이름을 보관합니다.

## 파일 역할

- `site-shell.css`: 화면 전체 배경, 헤더, 상단 메뉴, 패널 등 현재 운영 디자인의 최종 구조·표현 오버라이드
- `site-brand-motion.css`: 브랜드 영역과 페이지 진입 애니메이션, `prefers-reduced-motion` 대응

## 수정 규칙

1. 새 규칙은 역할에 맞는 공식 파일에만 추가합니다.
2. 루트의 `actual-redesign.css`, `brand-enhancements.css`는 호환 래퍼이므로 새 규칙을 추가하지 않습니다.
3. CSS 순서를 바꾸거나 파일을 분리할 때는 `config/page-assets.json`과 `scripts/validate-page-assets.mjs` 검사를 함께 갱신합니다.
4. 디자인 변경과 파일 구조 변경은 같은 커밋에서 섞지 않습니다.
5. 운영 `main` 반영 전 별도 브랜치에서 데스크톱과 모바일 화면을 비교합니다.
