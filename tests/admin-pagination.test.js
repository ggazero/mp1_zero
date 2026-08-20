const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const adminHtml = fs.readFileSync(path.join(projectRoot, "admin", "index.html"), "utf8");
const adminJs = fs.readFileSync(path.join(projectRoot, "js", "admin.js"), "utf8");
const stylesCss = fs.readFileSync(path.join(projectRoot, "assets", "styles.css"), "utf8");

test("접수내역은 5개, 10개, 15개 단위로 볼 수 있다", () => {
  for (const size of [5, 10, 15]) {
    assert.match(adminHtml, new RegExp(`<option value="${size}">${size}개</option>`));
  }
});

test("접수내역에 통계와 이전·다음 페이지 기능이 연결되어 있다", () => {
  for (const id of [
    "application-result-count",
    "application-complete-count",
    "application-pending-count",
    "payment-complete-count",
    "application-prev-page",
    "application-next-page"
  ]) {
    assert.match(adminHtml, new RegExp(`id="${id}"`));
  }
  assert.match(adminJs, /visible\.slice\(startIndex, endIndex\)/);
  assert.match(adminJs, /currentApplicationPage -= 1/);
  assert.match(adminJs, /currentApplicationPage \+= 1/);
});

test("자격증별 통계 카드를 누르면 해당 접수내역으로 필터링된다", () => {
  assert.match(adminHtml, /id="certificate-stat-cards"/);
  assert.match(adminJs, /data-certificate-stat/);
  assert.match(adminJs, /filter\.value = card\.dataset\.certificateStat/);
  assert.match(adminJs, /renderCertificateStats\(\)/);
});

test("접수상태가 접수내역의 첫 번째 열에 표시된다", () => {
  assert.match(adminHtml, /<thead><tr><th>접수상태<\/th><th>출처<\/th>/);
  assert.match(adminJs, /<td><span class="status-pill \$\{applicationStatusClass\(item\.application_status\)\}">/);
});

test("관리자 로그인 후 톱니바퀴 메뉴에서 로그아웃할 수 있다", () => {
  assert.match(adminHtml, /id="admin-settings-toggle"/);
  assert.match(adminHtml, /id="admin-settings-menu"/);
  assert.match(adminHtml, /id="admin-signout"[^>]*>로그아웃<\/button>/);
  assert.match(adminJs, /adminSettings\.hidden = false/);
});

test("관리자 화면에서 고객 접수페이지로 돌아가는 홈 링크를 제공한다", () => {
  assert.match(adminHtml, /id="admin-home-link" class="admin-home-link" href="\.\.\/"/);
  assert.match(adminHtml, /고객 접수페이지로 돌아가기/);
  assert.match(adminHtml, /class="admin-home-icon"/);
});

test("관리자 인증 화면의 카드와 입력 규격을 일관되게 유지한다", () => {
  assert.match(adminHtml, /<body class="admin-page admin-auth-mode">/);
  assert.match(adminHtml, /class="section compact admin-main"/);
  assert.match(stylesCss, /\.admin-auth \{ width: min\(100%, 560px\); margin: 0 auto;/);
  assert.match(stylesCss, /\.admin-auth input \{ min-height: 54px;/);
  assert.match(stylesCss, /\.admin-auth \.button \{ width: 100%; min-height: 54px; \}/);
  assert.match(stylesCss, /\.admin-page\.admin-auth-mode \.admin-main \{ display: flex; align-items: center;/);
  assert.match(stylesCss, /\.admin-auth \{ padding: 24px; border-radius: 16px; \}/);
  assert.match(adminJs, /document\.body\.classList\.remove\("admin-auth-mode"\)/);
});

test("고객 페이지로 돌아가면 관리자 잠금이 다시 설정된다", () => {
  assert.match(adminJs, /adminHomeLink\.addEventListener\("click"/);
  assert.match(adminJs, /window\.sessionStorage\.removeItem\(ADMIN_UNLOCK_KEY\)/);
});

test("관리자 상단에는 세 관리 메뉴만 표시한다", () => {
  assert.match(adminHtml, /id="admin-header-tabs"/);
  assert.match(adminHtml, />접수 내역<\/button>/);
  assert.match(adminHtml, />FAQ 문서<\/button>/);
  assert.match(adminHtml, />질문접수 내역<\/button>/);
  assert.doesNotMatch(adminHtml, />FAQ 상담<\/a>/);
});

test("관리자 메뉴를 선택하면 해당 서비스 내용만 표시한다", () => {
  const applicationsStart = adminHtml.indexOf('id="applications-panel"');
  const faqStart = adminHtml.indexOf('id="faq-panel"');
  const questionsStart = adminHtml.indexOf('id="questions-panel"');
  assert.ok(applicationsStart < adminHtml.indexOf('id="certificate-stat-cards"'));
  assert.ok(adminHtml.indexOf('id="certificate-stat-cards"') < faqStart);
  assert.ok(faqStart < questionsStart);
  assert.match(adminJs, /panel\.hidden = panel\.id !== panelId/);
  assert.match(adminJs, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
});

test("질문접수 내역에 신규 접수와 처리 현황을 표시한다", () => {
  for (const id of [
    "question-total-count",
    "question-new-count",
    "question-auto-count",
    "question-answered-count"
  ]) {
    assert.match(adminHtml, new RegExp(`id="${id}"`));
  }
  assert.match(adminJs, /item\.answerStatus === "unanswered"/);
  assert.match(adminJs, /item\.answerStatus === "auto_answered"/);
  assert.match(adminJs, /item\.answerStatus === "answered"/);
  assert.match(adminJs, /updateQuestionStats\(\)/);
});
