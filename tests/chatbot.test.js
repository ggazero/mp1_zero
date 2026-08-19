const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_FAQS, UNKNOWN, PRACTICAL, answerQuestion } = require("../js/knowledge.js");

test("한식 접수비를 응시료 질문으로 이해한다", () => {
  assert.match(answerQuestion("한식 접수비가 얼마예요?").answer, /14,500원/);
});

test("요양보호사 응시료는 모른다고 답한다", () => {
  assert.equal(answerQuestion("요양보호사 시험비가 얼마예요?").answer, UNKNOWN);
});

test("공인중개사 응시료는 모른다고 답한다", () => {
  assert.equal(answerQuestion("공인중개사 1차 접수비 알려줘").answer, UNKNOWN);
});

test("실기 질문은 필기 안내 범위를 고지한다", () => {
  assert.equal(answerQuestion("한식 실기 시험도 접수해 주나요?").answer, PRACTICAL);
});

test("문서에 없는 주차 질문은 모른다고 답한다", () => {
  assert.equal(answerQuestion("시험장에 주차 되나요?").answer, UNKNOWN);
});

test("요양보호사 접수 일정을 안내한다", () => {
  assert.match(answerQuestion("요양사는 언제 접수해요?").answer, /7일 전/);
});

test("공인중개사 접수 일정을 안내한다", () => {
  assert.match(answerQuestion("공인중개사 접수는 끝났나요?").answer, /종료/);
});

test("FAQ 관리자가 바꾼 답변이 챗봇에 반영된다", () => {
  const changed = DEFAULT_FAQS.map((faq) => faq.id === "fee-cook" ? { ...faq, answer: "변경된 안내입니다." } : faq);
  assert.equal(answerQuestion("한식 접수비가 얼마예요?", changed).answer, "변경된 안내입니다.");
});
