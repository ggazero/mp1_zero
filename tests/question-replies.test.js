const test = require("node:test");
const assert = require("node:assert/strict");

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

test("미답변 질문의 연락처와 관리자 답변 상태를 로컬에서도 보존한다", () => {
  global.localStorage = createStorage();
  delete require.cache[require.resolve("../js/storage.js")];
  const storage = require("../js/storage.js");
  storage.saveQuestion({
    id: "Q-TEST",
    question: "추가 확인이 필요한 질문",
    answer: "확인할 수 없습니다.",
    kind: "unknown",
    contactMethod: "email",
    contactValue: "tester@example.com",
    answerStatus: "unanswered"
  });
  storage.saveQuestionAnswer("Q-TEST", "관리자 확인 답변입니다.");
  const saved = storage.getQuestions()[0];
  assert.equal(saved.contactMethod, "email");
  assert.equal(saved.contactValue, "tester@example.com");
  assert.equal(saved.adminAnswer, "관리자 확인 답변입니다.");
  assert.equal(saved.answerStatus, "answered");
  assert.match(saved.answeredAt, /^\d{4}-\d{2}-\d{2}T/);
  delete global.localStorage;
});
