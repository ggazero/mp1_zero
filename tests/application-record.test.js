const test = require("node:test");
const assert = require("node:assert/strict");

function createElement(initial = {}) {
  const classes = new Set();
  return {
    value: "",
    hidden: false,
    disabled: false,
    textContent: "",
    listeners: {},
    focused: false,
    style: {},
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name)
    },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    focus() { this.focused = true; },
    ...initial
  };
}

function setupPage(findApplication) {
  const elements = {};
  [
    "#lookup-receipt-number", "#lookup-phone", "#lookup-status", "#lookup-result",
    "#lookup-result-id", "#lookup-result-name", "#lookup-result-certificate",
    "#lookup-result-date", "#lookup-result-status", "#lookup-copy-status",
    "#copy-success-id", "#copy-success-content", "#print-success",
    "#copy-lookup-id", "#copy-lookup-content", "#success-receipt-number",
    "#success-name", "#success-certificate", "#success-created-at", "#success-copy-status"
  ].forEach((selector) => { elements[selector] = createElement(); });
  elements["#lookup-result"].hidden = true;
  const lookupSubmit = createElement({ textContent: "접수내용 확인" });
  elements["#application-lookup-form"] = createElement({ querySelector: () => lookupSubmit });
  const copied = [];
  let printCount = 0;
  const fakeWindow = {
    document: { querySelector: (selector) => elements[selector] },
    navigator: { clipboard: { async writeText(value) { copied.push(value); } } },
    DuduApi: { findApplication },
    print() { printCount += 1; }
  };
  global.window = fakeWindow;
  delete require.cache[require.resolve("../js/application-record.js")];
  const recordUi = require("../js/application-record.js");
  return { elements, lookupSubmit, copied, recordUi, getPrintCount: () => printCount };
}

test("접수 완료 화면에서 번호·내용 복사와 인쇄가 작동한다", async () => {
  const page = setupPage(async () => null);
  const application = {
    id: "DUDU-20260819-120000-AA",
    name: "테스터",
    certificate: "전기기능사",
    createdAt: "2026-08-19T03:00:00.000Z",
    status: "신규"
  };
  page.recordUi.showSuccess(application);

  assert.equal(page.elements["#success-receipt-number"].textContent, application.id);
  assert.equal(page.elements["#success-name"].textContent, "테스터");
  assert.equal(page.elements["#success-certificate"].textContent, "전기기능사");

  await page.elements["#copy-success-id"].listeners.click();
  assert.equal(page.copied.at(-1), application.id);
  await page.elements["#copy-success-content"].listeners.click();
  assert.match(page.copied.at(-1), /접수번호: DUDU-20260819-120000-AA/);
  assert.match(page.copied.at(-1), /이름: 테스터/);
  assert.match(page.copied.at(-1), /신청 자격증: 전기기능사/);
  assert.match(page.copied.at(-1), /접수 일시:/);

  page.elements["#print-success"].listeners.click();
  assert.equal(page.getPrintCount(), 1);
  delete global.window;
});

test("접수번호와 연락처가 모두 맞을 때만 마스킹된 접수내역을 표시한다", async () => {
  const correctId = "DUDU-20260819-120000-AA";
  const correctPhone = "010-1234-5678";
  const page = setupPage(async (id, phone) => (
    id === correctId && phone === correctPhone
      ? { id, name: "테*터", certificate: "전기기능사", createdAt: "2026-08-19T03:00:00.000Z", status: "신규" }
      : null
  ));
  const form = page.elements["#application-lookup-form"];

  page.elements["#lookup-receipt-number"].value = correctId;
  page.elements["#lookup-phone"].value = correctPhone;
  await form.listeners.submit({ preventDefault() {} });
  assert.equal(page.elements["#lookup-result"].hidden, false);
  assert.equal(page.elements["#lookup-result-name"].textContent, "테*터");
  assert.equal(page.elements["#lookup-result-certificate"].textContent, "전기기능사");
  assert.equal(page.elements["#lookup-result-status"].textContent, "신규");

  await page.elements["#copy-lookup-id"].listeners.click();
  assert.equal(page.copied.at(-1), correctId);
  await page.elements["#copy-lookup-content"].listeners.click();
  assert.match(page.copied.at(-1), /이름: 테\*터/);
  assert.match(page.copied.at(-1), /현재 처리 상태: 신규/);

  page.elements["#lookup-phone"].value = "010-9999-9999";
  await form.listeners.submit({ preventDefault() {} });
  assert.equal(page.elements["#lookup-result"].hidden, true);
  assert.equal(page.elements["#lookup-status"].textContent, page.recordUi.LOOKUP_FAILURE);

  page.elements["#lookup-receipt-number"].value = "DUDU-WRONG";
  page.elements["#lookup-phone"].value = correctPhone;
  await form.listeners.submit({ preventDefault() {} });
  assert.equal(page.elements["#lookup-result"].hidden, true);
  assert.equal(page.elements["#lookup-status"].textContent, page.recordUi.LOOKUP_FAILURE);
  delete global.window;
});
