(function () {
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#question");
  const log = document.querySelector("#chat-log");
  const contactMethod = document.querySelector("#contact-method");
  const contactValue = document.querySelector("#contact-value");
  const contactStatus = document.querySelector("#contact-status");

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

  async function askStage6(question) {
    try {
      const stage6Url = String((window.DUDU_CONFIG || {}).STAGE6_API_URL || "").replace(/\/$/, "");
      if (!stage6Url) return null;

      const submit = await fetch(`${stage6Url}/gradio_api/call/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [question] })
      });
      if (!submit.ok) return null;
      const { event_id: eventId } = await submit.json();
      if (!eventId) return null;

      const result = await fetch(`${stage6Url}/gradio_api/call/chat/${eventId}`);
      if (!result.ok) return null;
      const body = await result.text();

      for (const line of body.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          if (Array.isArray(payload) && payload[0]) {
            return payload[0];
          }
        } catch (_) { continue; }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  async function ask(question) {
    const value = question.trim();
    if (!value) return false;
    const contact = readContact();
    if (!contact) return false;
    appendMessage(value, "user");

    let faqs = DuduKnowledge.DEFAULT_FAQS;
    try { faqs = await DuduApi.getFaqs(DuduKnowledge.DEFAULT_FAQS); } catch (_) { /* 기본 문서로 안전하게 응답 */ }
    const result = DuduKnowledge.answerQuestion(value, faqs);

    let finalAnswer = result.answer;
    let finalSource = result.source;

    if (result.kind === "unknown") {
      const stage6Answer = await askStage6(value);
      if (stage6Answer && typeof stage6Answer === "string" && stage6Answer.trim()) {
        finalAnswer = stage6Answer;
        finalSource = "Stage6 FAQ";
        result.kind = "answer";
      }
    }

    const logItem = {
      id: `Q-${Date.now()}`,
      question: value,
      answer: finalAnswer,
      kind: result.kind,
      createdAt: new Date().toISOString(),
      contactMethod: result.kind === "answer" ? "" : contact.method,
      contactValue: result.kind === "answer" ? "" : contact.value,
      answerStatus: result.kind === "answer" ? "auto_answered" : "unanswered"
    };
    try { await DuduApi.saveQuestion(logItem); } catch (_) { /* 답변은 계속 제공 */ }
    DuduApi.sendEvent({
      event: "chatbot_question",
      result_type: result.kind,
      timestamp: new Date().toISOString()
    }).catch(() => {});
    const followUp = result.kind !== "answer" && contact.value ? "\n\n관리자 후속 답변 요청이 함께 접수되었습니다." : "";
    window.setTimeout(() => appendMessage(`${finalAnswer}${followUp}`, "bot", finalSource), 180);
    return true;
  }

  function readContact() {
    contactStatus.textContent = "";
    contactStatus.className = "form-status";
    const method = contactMethod.value;
    const value = contactValue.value.trim();
    if (!method) return { method: "", value: "" };
    if (method === "phone" && !/^01\d-?\d{3,4}-?\d{4}$/.test(value)) {
      contactStatus.textContent = "답변받을 휴대전화 번호를 정확히 입력해 주세요.";
      contactStatus.className = "form-status error";
      contactValue.focus();
      return null;
    }
    if (method === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      contactStatus.textContent = "답변받을 이메일 주소를 정확히 입력해 주세요.";
      contactStatus.className = "form-status error";
      contactValue.focus();
      return null;
    }
    return { method, value };
  }

  contactMethod.addEventListener("change", () => {
    const method = contactMethod.value;
    contactValue.disabled = !method;
    contactValue.value = "";
    contactValue.type = method === "email" ? "email" : "tel";
    contactValue.autocomplete = method === "email" ? "email" : "tel";
    contactValue.placeholder = method === "email" ? "example@email.com" : "010-1234-5678";
    contactStatus.textContent = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (await ask(input.value)) {
      input.value = "";
      input.focus();
    }
  });
  document.querySelectorAll(".quick-question").forEach((button) => button.addEventListener("click", async () => { await ask(button.textContent); }));
})();
