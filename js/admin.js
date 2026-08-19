(function () {
  const applicationBody = document.querySelector("#application-body");
  const questionBody = document.querySelector("#question-body");
  const search = document.querySelector("#application-search");
  const filter = document.querySelector("#certificate-filter");
  const adminAuth = document.querySelector("#admin-auth");
  const adminContent = document.querySelector("#admin-content");
  const DEMO_ADMIN_PASSWORD = "0000";
  const ADMIN_UNLOCK_KEY = "dudu-demo-admin-unlocked-v1";
  let applications = [];
  let currentFaqs = [];

  const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const formatDate = (value) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  const localDay = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(value));

  function renderApplications() {
    const query = search.value.trim().toLowerCase();
    const visible = applications.filter((item) => {
      const matchesQuery = !query || item.name.toLowerCase().includes(query) || item.phone.includes(query) || item.id.toLowerCase().includes(query);
      return matchesQuery && (!filter.value || item.certificate === filter.value);
    });
    applicationBody.innerHTML = visible.length ? visible.map((item) => `
      <tr>
        <td>${escapeHtml(formatDate(item.createdAt))}</td><td>${escapeHtml(item.id)}</td><td><strong>${escapeHtml(item.name)}</strong></td>
        <td>${escapeHtml(item.phone)}</td><td>${escapeHtml(item.certificate)}</td>
        <td><select class="status-select" data-id="${escapeHtml(item.id)}" data-before="${escapeHtml(item.status)}" aria-label="${escapeHtml(item.name)} 상태"><option ${item.status === "신규" ? "selected" : ""}>신규</option><option ${item.status === "확인" ? "selected" : ""}>확인</option><option ${item.status === "완료" ? "selected" : ""}>완료</option></select></td>
        <td>${escapeHtml(item.note || "-")}</td>
      </tr>`).join("") : '<tr><td class="empty" colspan="7">조건에 맞는 접수 내역이 없습니다. 접수 화면에서 신청서를 제출해 보세요.</td></tr>';
    document.querySelectorAll(".status-select").forEach((select) => select.addEventListener("change", async () => {
      const before = select.dataset.before;
      select.disabled = true;
      try {
        await DuduApi.updateApplication(select.dataset.id, { status: select.value });
        const target = applications.find((item) => item.id === select.dataset.id);
        if (target) target.status = select.value;
        select.dataset.before = select.value;
      } catch (error) {
        select.value = before;
        window.alert(`상태를 저장하지 못했습니다. ${error.message}`);
      } finally {
        select.disabled = false;
      }
    }));
    updateStats();
  }

  function updateStats() {
    const today = localDay(new Date());
    document.querySelector("#today-count").textContent = `${applications.filter((item) => localDay(item.createdAt) === today).length}건`;
    document.querySelector("#total-count").textContent = `${applications.length}건`;
    const counts = applications.reduce((acc, item) => ({ ...acc, [item.certificate]: (acc[item.certificate] || 0) + 1 }), {});
    const popular = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    document.querySelector("#popular-certificate").textContent = popular ? `${popular[0]} (${popular[1]}건)` : "아직 없음";
  }

  function renderFaqs() {
    document.querySelector("#faq-editor-list").innerHTML = currentFaqs.map((faq, index) => `
      <article class="faq-editor">
        <div class="faq-editor-head"><h3>${escapeHtml(faq.title)}</h3><span class="tag">${escapeHtml(faq.category)}</span></div>
        <label class="field-label" for="faq-${index}">챗봇 답변</label>
        <textarea id="faq-${index}" data-faq-index="${index}" maxlength="500">${escapeHtml(faq.answer)}</textarea>
        <p class="field-help">검색어: ${escapeHtml(faq.keywords.join(", "))}</p>
      </article>`).join("");
  }

  function renderQuestions(questions) {
    const labels = { answer: "문서 답변", unknown: "모름", restricted: "범위 밖", empty: "빈 질문" };
    questionBody.innerHTML = questions.length ? questions.map((item) => `<tr><td>${escapeHtml(formatDate(item.createdAt))}</td><td><strong>${escapeHtml(item.question)}</strong></td><td><span class="status-pill ${item.kind === "answer" ? "new" : ""}">${escapeHtml(labels[item.kind] || item.kind)}</span></td><td>${escapeHtml(item.answer)}</td></tr>`).join("") : '<tr><td class="empty" colspan="4">아직 챗봇 질문 기록이 없습니다.</td></tr>';
  }

  async function loadQuestions() {
    questionBody.innerHTML = '<tr><td class="empty" colspan="4">질문 기록을 불러오는 중입니다…</td></tr>';
    try { renderQuestions(await DuduApi.getQuestions()); }
    catch (error) { questionBody.innerHTML = `<tr><td class="empty" colspan="4">${escapeHtml(error.message)}</td></tr>`; }
  }

  document.querySelectorAll(".tab-button").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll(".tab-button").forEach((item) => { item.classList.toggle("active", item === button); item.setAttribute("aria-selected", String(item === button)); });
    document.querySelectorAll(".tab-panel").forEach((panel) => { panel.hidden = panel.id !== button.dataset.tab; });
    if (button.dataset.tab === "questions-panel") loadQuestions();
  }));
  search.addEventListener("input", renderApplications);
  filter.addEventListener("change", renderApplications);

  document.querySelector("#save-faq").addEventListener("click", async () => {
    const status = document.querySelector("#faq-status");
    document.querySelectorAll("[data-faq-index]").forEach((textarea) => { currentFaqs[Number(textarea.dataset.faqIndex)].answer = textarea.value.trim(); });
    if (currentFaqs.some((faq) => !faq.answer)) {
      status.textContent = "빈 답변이 있습니다. 모든 답변을 입력해 주세요.";
      status.className = "form-status error";
      return;
    }
    try {
      await DuduApi.saveFaqs(currentFaqs);
      status.textContent = "변경한 FAQ를 저장했습니다. 챗봇의 다음 답변부터 반영됩니다.";
      status.className = "form-status";
    } catch (error) {
      status.textContent = `FAQ를 저장하지 못했습니다. ${error.message}`;
      status.className = "form-status error";
    }
  });

  document.querySelector("#reset-faq").addEventListener("click", async () => {
    if (!window.confirm("FAQ 답변을 처음 문서 내용으로 되돌릴까요?")) return;
    try {
      await DuduApi.resetFaqs(DuduKnowledge.DEFAULT_FAQS);
      currentFaqs = DuduKnowledge.DEFAULT_FAQS.map((faq) => ({ ...faq, keywords: [...faq.keywords] }));
      renderFaqs();
      document.querySelector("#faq-status").textContent = "기본 FAQ 문서로 되돌렸습니다.";
    } catch (error) {
      document.querySelector("#faq-status").textContent = `기본 문서로 되돌리지 못했습니다. ${error.message}`;
    }
  });

  document.querySelector("#export-csv").addEventListener("click", () => {
    if (!applications.length) return window.alert("내려받을 접수 내역이 없습니다.");
    const cells = [["접수일시", "접수번호", "이름", "연락처", "자격증", "접수경로", "상태", "비고"], ...applications.map((item) => [item.createdAt, item.id, item.name, item.phone, item.certificate, item.channel, item.status, item.note])];
    const csv = cells.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = `두두접수내역_${localDay(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  });

  document.querySelector("#admin-login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const status = document.querySelector("#login-status");
    if (document.querySelector("#admin-password").value !== DEMO_ADMIN_PASSWORD) {
      status.textContent = "비밀번호가 올바르지 않습니다.";
      status.className = "form-status error";
      return;
    }
    window.sessionStorage.setItem(ADMIN_UNLOCK_KEY, "true");
    window.location.reload();
  });

  document.querySelector("#admin-signout").addEventListener("click", () => {
    window.sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
    DuduApi.signOut();
    window.location.reload();
  });

  async function init() {
    const configured = DuduApi.isConfigured();
    if (window.sessionStorage.getItem(ADMIN_UNLOCK_KEY) !== "true") {
      adminAuth.hidden = false;
      adminContent.hidden = true;
      return;
    }
    adminAuth.hidden = true;
    adminContent.hidden = false;
    if (configured) {
      document.querySelector("#storage-notice").hidden = true;
      document.querySelector("#connection-state").textContent = "Supabase 연결됨 · 실습 관리자";
      document.querySelector("#admin-signout").hidden = false;
    } else {
      document.querySelector("#connection-state").textContent = "로컬 데모 모드";
    }
    applicationBody.innerHTML = '<tr><td class="empty" colspan="7">접수 내역을 불러오는 중입니다…</td></tr>';
    try {
      [applications, currentFaqs] = await Promise.all([DuduApi.getApplications(), DuduApi.getFaqs(DuduKnowledge.DEFAULT_FAQS)]);
      currentFaqs = currentFaqs.map((faq) => ({ ...faq, keywords: [...faq.keywords] }));
      renderApplications();
      renderFaqs();
      await loadQuestions();
    } catch (error) {
      applicationBody.innerHTML = `<tr><td class="empty" colspan="7">${escapeHtml(error.message)}</td></tr>`;
    }
  }

  init();
})();
