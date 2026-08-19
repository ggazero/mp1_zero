(function () {
  const applicationBody = document.querySelector("#application-body");
  const questionBody = document.querySelector("#question-body");
  const search = document.querySelector("#application-search");
  const filter = document.querySelector("#certificate-filter");
  const sourceFilter = document.querySelector("#source-filter");
  const statusFilter = document.querySelector("#status-filter");
  const adminAuth = document.querySelector("#admin-auth");
  const adminContent = document.querySelector("#admin-content");
  const DEMO_ADMIN_PASSWORD = "0000";
  const ADMIN_UNLOCK_KEY = "dudu-demo-admin-unlocked-v1";
  let applications = [];
  let currentFaqs = [];

  const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const formatDate = (value) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  const localDay = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(value));
  const formatFee = (value) => Number.isFinite(value) ? `${new Intl.NumberFormat("ko-KR").format(value)}원` : (value || "-");

  function setFilterOptions(select, label, values) {
    select.innerHTML = `<option value="">${label}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  }

  function populateFilters() {
    setFilterOptions(sourceFilter, "모든 출처", [...new Set(applications.map((item) => item.source))]);
    setFilterOptions(filter, "모든 자격증", [...new Set(applications.map((item) => item.qualification))].sort());
    setFilterOptions(statusFilter, "모든 접수상태", [...new Set(applications.map((item) => item.application_status))]);
  }

  function renderApplications() {
    const query = search.value.trim().toLowerCase();
    const visible = applications.filter((item) => {
      const matchesQuery = !query || item.applicant_name.toLowerCase().includes(query) || item.phone.includes(query) || item.receipt_number.toLowerCase().includes(query);
      return matchesQuery
        && (!sourceFilter.value || item.source === sourceFilter.value)
        && (!filter.value || item.qualification === filter.value)
        && (!statusFilter.value || item.application_status === statusFilter.value);
    });
    applicationBody.innerHTML = visible.length ? visible.map((item) => `
      <tr>
        <td><span class="status-pill new">${escapeHtml(item.source)}</span></td>
        <td>${escapeHtml(item.receipt_number)}</td><td>${escapeHtml(item.applied_at)}</td><td><strong>${escapeHtml(item.applicant_name)}</strong></td>
        <td>${escapeHtml(item.phone)}</td><td>${escapeHtml(item.qualification)}</td><td>${escapeHtml(item.exam_date)}</td>
        <td>${escapeHtml(item.exam_center || "-")}</td><td>${escapeHtml(formatFee(item.final_fee))}</td><td>${escapeHtml(item.payment_status)}</td>
        <td><span class="status-pill ${item.application_status === "접수완료" ? "new" : ""}">${escapeHtml(item.application_status)}</span></td>
      </tr>`).join("") : '<tr><td class="empty" colspan="11">조건에 맞는 기존 접수 이력이 없습니다.</td></tr>';
    updateStats();
  }

  function updateStats() {
    const today = localDay(new Date());
    document.querySelector("#today-count").textContent = `${applications.filter((item) => item.applied_at === today).length}건`;
    document.querySelector("#total-count").textContent = `${applications.length}건`;
    const counts = applications.reduce((acc, item) => ({ ...acc, [item.qualification]: (acc[item.qualification] || 0) + 1 }), {});
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
  sourceFilter.addEventListener("change", renderApplications);
  filter.addEventListener("change", renderApplications);
  statusFilter.addEventListener("change", renderApplications);

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
    const cells = [["출처", "접수번호", "접수일", "이름", "연락처", "자격증", "시험일", "시험장", "최종결제금액", "결제상태", "접수상태"], ...applications.map((item) => [item.source, item.receipt_number, item.applied_at, item.applicant_name, item.phone, item.qualification, item.exam_date, item.exam_center, item.final_fee, item.payment_status, item.application_status])];
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
      document.querySelector("#connection-state").textContent = "draft_100 통합 조회 · Supabase 연결 유지";
      document.querySelector("#admin-signout").hidden = false;
    } else {
      document.querySelector("#connection-state").textContent = "로컬 데모 모드";
    }
    applicationBody.innerHTML = '<tr><td class="empty" colspan="11">세 접수 데이터를 불러오는 중입니다…</td></tr>';
    try {
      const result = await DuduAdminData.loadDraft100("../data/draft_100");
      applications = result.records;
      populateFilters();
      renderApplications();
      const countText = `총 ${applications.length}건 · 국가기술자격 ${result.counts["국가기술자격"]}건 · 전문자격 ${result.counts["전문자격"]}건 · 두두보건 ${result.counts["두두보건"]}건`;
      document.querySelector("#draft-load-status").textContent = result.errors.length ? `${countText} · 로딩 실패: ${result.errors.join(" / ")}` : `${countText}을 정상적으로 불러왔습니다.`;
    } catch (error) {
      applicationBody.innerHTML = `<tr><td class="empty" colspan="11">draft_100 통합조회 실패: ${escapeHtml(error.message)}</td></tr>`;
      document.querySelector("#draft-load-status").textContent = `draft_100 통합조회 실패: ${error.message}`;
    }
    try {
      currentFaqs = await DuduApi.getFaqs(DuduKnowledge.DEFAULT_FAQS);
      currentFaqs = currentFaqs.map((faq) => ({ ...faq, keywords: [...faq.keywords] }));
      renderFaqs();
      await loadQuestions();
    } catch (error) {
      document.querySelector("#faq-status").textContent = error.message;
    }
  }

  init();
})();
