const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const CERTIFICATES = [
  "한식조리기능사",
  "지게차운전기능사",
  "굴착기운전기능사",
  "전기기능사",
  "손해평가사",
  "공인중개사",
  "요양보호사",
  "위생사"
];

function createElement(initial = {}) {
  const classes = new Set();
  return {
    value: "",
    checked: false,
    hidden: false,
    disabled: false,
    textContent: "",
    className: "",
    dataset: {},
    attributes: {},
    listeners: {},
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle(name, force) { force ? classes.add(name) : classes.delete(name); },
      contains: (name) => classes.has(name)
    },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() {},
    scrollIntoView() {},
    ...initial
  };
}

test("접수페이지 카드와 선택 목록에 자격증 8종이 정확히 표시된다", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const cards = [...html.matchAll(/data-certificate="([^"]+)"/g)].map((match) => match[1]);
  const selectHtml = html.match(/<select id="certificate"[\s\S]*?<\/select>/)[0];
  const options = [...selectHtml.matchAll(/<option(?:\s[^>]*)?>([^<]*)<\/option>/g)]
    .map((match) => match[1].trim())
    .filter((value) => value && value !== "자격증을 선택해 주세요");

  assert.deepEqual(cards, CERTIFICATES);
  assert.deepEqual(options, CERTIFICATES);
});

test("8개 카드를 선택하면 저장 데이터에 해당 자격증명이 들어간다", async () => {
  global.window = global;
  const cards = CERTIFICATES.map((certificate) => createElement({ dataset: { certificate } }));
  const certificate = createElement();
  const phone = createElement({ value: "010-1234-5678" });
  const status = createElement();
  const successBox = createElement();
  const privacy = createElement({ checked: true });
  const successDetail = createElement();
  const newApplication = createElement();
  const applicationSection = createElement();
  const submitButton = createElement({ textContent: "접수 도움 신청하기" });
  const name = createElement({ value: "홍길동" });
  const note = createElement({ value: "카드 선택 테스트" });
  const saved = [];
  let resetCount = 0;
  const form = createElement({
    elements: { name, note },
    querySelector: () => submitButton,
    reset() { resetCount += 1; }
  });
  const elements = {
    "#application-form": form,
    "#certificate": certificate,
    "#phone": phone,
    "#form-status": status,
    "#success-box": successBox,
    "#privacy": privacy,
    "#success-detail": successDetail,
    "#new-application": newApplication,
    "#application": applicationSection
  };

  global.document = {
    querySelector: (selector) => elements[selector],
    querySelectorAll: (selector) => selector === ".cert-card" ? cards : []
  };
  global.DuduApi = {
    async saveApplication(application) { saved.push(application); }
  };

  delete require.cache[require.resolve("../js/application.js")];
  require("../js/application.js");

  for (const card of cards) {
    card.listeners.click();
    assert.equal(certificate.value, card.dataset.certificate);
    await form.listeners.submit({ preventDefault() {} });
    assert.equal(saved.at(-1).certificate, card.dataset.certificate);
  }

  assert.deepEqual(saved.map((application) => application.certificate), CERTIFICATES);
  newApplication.listeners.click();
  assert.equal(resetCount, 1);
  assert.equal(form.hidden, false);
  assert.equal(certificate.value, "");
  assert.equal(successBox.classList.contains("show"), false);
  delete global.document;
  delete global.DuduApi;
  delete global.window;
});

test("Supabase 자격증 허용 목록 확장 SQL에 8종이 모두 들어 있다", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "migrations", "20260819000300_application_certificates.sql"),
    "utf8"
  );
  CERTIFICATES.forEach((certificate) => assert.match(sql, new RegExp(certificate)));
});
