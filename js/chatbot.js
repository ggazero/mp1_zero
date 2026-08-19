(function () {
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#question");
  const log = document.querySelector("#chat-log");

  function appendMessage(text, role, source) {
    const message = document.createElement("div");
    message.className = `message ${role}`;
    message.textContent = text;
    if (source) {
      const sourceNode = document.createElement("span");
      sourceNode.className = "message-source";
      sourceNode.textContent = `근거 · ${source}`;
      message.appendChild(sourceNode);
    }
    log.appendChild(message);
    log.scrollTop = log.scrollHeight;
  }

  async function ask(question) {
    const value = question.trim();
    if (!value) return;
    appendMessage(value, "user");
    let faqs = DuduKnowledge.DEFAULT_FAQS;
    try { faqs = await DuduApi.getFaqs(DuduKnowledge.DEFAULT_FAQS); } catch (_) { /* 기본 문서로 안전하게 응답 */ }
    const result = DuduKnowledge.answerQuestion(value, faqs);
    const logItem = {
      id: `Q-${Date.now()}`,
      question: value,
      answer: result.answer,
      kind: result.kind,
      createdAt: new Date().toISOString()
    };
    try { await DuduApi.saveQuestion(logItem); } catch (_) { /* 답변은 계속 제공 */ }
    window.setTimeout(() => appendMessage(result.answer, "bot", result.source), 180);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(input.value);
    input.value = "";
    input.focus();
  });
  document.querySelectorAll(".quick-question").forEach((button) => button.addEventListener("click", () => ask(button.textContent)));
})();
