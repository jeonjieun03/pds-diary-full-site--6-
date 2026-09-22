# 플랜두씨 다이어리 1 (SKT ALEPH 과제 6)

계획(Plan) → 실제로 한 일(Do) → 돌아보기(See)가 서버 데이터베이스로 이어지는 개인용 다이어리입니다.
로그인은 없고, 링크를 아는 사람은 누구나 볼 수 있습니다(첫 화면에 안내가 적혀 있습니다).

## 1. Supabase 프로젝트 만들기 (실제 서버 데이터베이스)

1. https://supabase.com 에서 무료로 가입하고 새 프로젝트를 만듭니다. (프로젝트 생성에는 로그인이 필요하지만, 이건 지은님 관리자용이고 **앱을 보는 사람에게는 로그인이 필요 없습니다**.)
2. 프로젝트가 준비되면 왼쪽 메뉴 **SQL Editor**로 들어가 `sql/schema.sql` 내용 전체를 붙여넣고 실행합니다.
   - 테이블 5개(plans, plan_revisions, todos, executions, review_notes)와 "누구나 읽기/쓰기 가능" RLS 정책이 만들어집니다.
   - 왜 이렇게 여는지: 이번 과제는 아직 로그인이 없는 과제라서 그렇습니다. 잠그는 일은 7번 과제에서 합니다.
3. 왼쪽 메뉴 **Project Settings → API**에서 다음 두 값을 복사합니다.
   - Project URL
   - anon public 키 (⚠️ service_role 키는 절대 쓰지 마세요 — 그건 진짜 비밀키입니다)
4. `js/config.js` 파일을 열어 두 값을 붙여넣습니다.

## 2. 로컬에서 확인

정적 파일만으로 동작하므로, 아무 정적 서버로 열면 됩니다. 예:

```bash
npx serve .
# 또는
python3 -m http.server 8080
```

브라우저에서 열어 계획 1개, 할 일 5개 이상, 실행 기록 3개 이상을 실제로 입력해보고,
새로고침해도 그대로 남는지 확인하세요.

## 3. GitHub Pages로 배포 (결과물 주소)

1. 이 폴더 전체를 본인 GitHub 저장소에 올립니다.
2. 저장소 Settings → Pages 에서 배포를 켭니다(브랜치는 main, 루트 폴더).
3. 발급된 `https://<아이디>.github.io/<저장소>/` 주소가 "결과물 주소"입니다.
4. 저장소 링크 자체가 "소스 주소"입니다.

## 4. 제출 전 마지막 확인 (완주 체크리스트에 맞춰)

- [ ] 새 시크릿 창에서 결과물 주소가 로그인 없이 열리는지
- [ ] 내가 실제로 세운 계획 1개 이상, 딸린 할 일 5개 이상, 실행 기록 3개 이상이 들어 있는지
- [ ] 새로고침해도 값이 그대로인지
- [ ] 돌아보기 숫자가 모두 0은 아닌지, 숫자를 눌러 근거 기록으로 이동되는지
- [ ] 첫 화면에 공개 안내 문구가 그대로 보이는지
- [ ] 할 일 입력창에 `<script>alert(1)</script>` 같은 걸 넣어봐도 글자 그대로만 보이는지
- [ ] 브라우저 개발자도구(F12) → Network/콘솔에 service_role 키나 다른 비밀값이 안 보이는지 (anon 키는 원래 공개용이라 괜찮습니다)
- [ ] `contracts/pds-schema-v2.json`을 최종 소스에 포함했는지

## 폴더 구조

```
index.html
css/style.css
js/config.js          ← Supabase 주소/키 (직접 채우기)
js/supabaseClient.js
js/utils.js
js/data.js             ← Supabase CRUD
js/app.js              ← 화면 로직
sql/schema.sql          ← Supabase에서 실행할 테이블/정책
contracts/pds-schema-v2.json  ← 최종 DB 계약 문서
```
