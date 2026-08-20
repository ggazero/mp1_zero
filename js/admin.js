(function () {
  const applicationBody = document.querySelector("#application-body");
  const questionBody = document.querySelector("#question-body");
  const search = document.querySelector("#application-search");
  const filter = document.querySelector("#certificate-filter");
  const sourceFilter = document.querySelector("#source-filter");
  const statusFilter = document.querySelector("#status-filter");
  const pageSizeSelect = document.querySelector("#application-page-size");
  const previousPageButton = document.querySelector("#application-prev-page");
  const nextPageButton = document.querySelector("#application-next-page");
  const pageNumbers = document.querySelector("#application-page-numbers");
  const pageSummary = document.querySelector("#application-page-summary");
  const certificateStatCards = document.querySelector("#certificate-stat-cards");
  const adminAuth = document.querySelector("#admin-auth");
  const adminContent = document.querySelector("#admin-content");
  const applicationDialog = document.querySelector("#application-dialog");
  const questionDialog = document.querySelector("#question-dialog");
  const questionAnswerForm = document.querySelector("#question-answer-form");
  const adminSettings = document.querySelector("#admin-settings");
  const adminSettingsToggle = document.querySelector("#admin-settings-toggle");
  const adminSettingsMenu = document.querySelector("#admin-settings-menu");
  const adminHeaderTabs = document.querySelector("#admin-header-tabs");
  const adminHomeLink = document.querySelector("#admin-home-link");
  const DEMO_ADMIN_PASSWORD = "0000";
  const ADMIN_UNLOCK_KEY = "dudu-demo-admin-unlocked-v1";
  let applications = [];
  let currentFaqs = [];
  let questions = [];
  let activeQuestionId = "";
  let currentApplicationPage = 1;
  let applicationPageSize = Number(pageSizeSelect.value) || 5;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const formatDate = (value) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  const localDay = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(value));
  const formatFee = (value) => Number.isFinite(value) ? `${new Intl.NumberFormat("ko-KR").format(value)}원` : (value || "-");

  function detailItemsHtml(items) {
    return items.map((item) => `<dl class="detail-item ${item.wide ? "wide" : ""}"><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value || "-")}</dd></dl>`).join("");
  }

  function bindClickableRows(selector, callback) {
    document.querySelectorAll(selector).forEach((row) => {
      const open = () => callback(Number(row.dataset.index));
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function openApplicationDetail(index) {
    const item = applications[index];
    if (!item) return;
    document.querySelector("#application-dialog-title").textContent = `${item.applicant_name} · ${item.receipt_number}`;
    document.querySelector("#application-common-detail").innerHTML = detailItemsHtml([
      { label: "출처", value: item.source }, { label: "접수번호", value: item.receipt_number },
      { label: "접수일", value: item.applied_at }, { label: "이름", value: item.applicant_name },
      { label: "생년월일", value: item.birth_date }, { label: "성별", value: item.gender },
      { label: "연락처", value: item.phone }, { label: "자격증", value: item.qualification },
      { label: "시험지역", value: item.exam_region || "-" }, { label: "시험장", value: item.exam_center },
      { label: "시험일", value: item.exam_date }, { label: "최종결제금액", value: formatFee(item.final_fee) },
      { label: "결제수단", value: item.payment_method }, { label: "결제상태", value: item.payment_status },
      { label: "접수상태", value: item.application_status }, { label: "사용맥락", value: item.usage_context }
    ]);
    document.querySelector("#application-source-detail").innerHTML = detailItemsHtml(DuduAdminData.getSourceDetailFields(item));
    applicationDialog.showModal();
  }

  function setFilterOptions(select, label, values) {
    select.innerHTML = `<option value="">${label}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  }

  function populateFilters() {
    setFilterOptions(sourceFilter, "모든 출처", [...new Set(applications.map((item) => item.source))]);
    setFilterOptions(filter, "모든 자격증", [...new Set(applications.map((item) => item.qualification))].sort());
    setFilterOptions(statusFilter, "모든 접수상태", [...new Set(applications.map((item) => item.application_status))]);
  }

  function applicationStatusClass(status) {
    if (status === "접수완료") return "new";
    if (status.includes("확인 필요") || status === "결제대기") return "attention";
    if (status === "취소") return "cancelled";
    return "";
  }

  function renderCertificateStats() {
    const counts = applications.reduce((result, item) => {
      result[item.qualification] = (result[item.qualification] || 0) + 1;
      return result;
    }, {});
    const ordered = Object.entries(counts).sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0], "ko"));
    const maximum = ordered[0]?.[1] || 1;
    certificateStatCards.innerHTML = ordered.map(([certificate, count], index) => {
      const percentage = Math.round((count / applications.length) * 100);
      const barWidth = Math.max(8, Math.round((count / maximum) * 100));
      return `<button class="certificate-stat-card" type="button" data-certificate-stat="${escapeHtml(certificate)}" aria-pressed="false">
        <span class="certificate-stat-rank">접수 ${index + 1}위</span>
        <span class="certificate-stat-name">${escapeHtml(certificate)}</span>
        <strong>${count}건 <small>${percentage}%</small></strong>
        <span class="certificate-stat-bar" aria-hidden="true"><span style="width:${barWidth}%"></span></span>
      </button>`;
    }).join("");
  }

  function updateCertificateCardSelection() {
    document.querySelectorAll("[data-certificate-stat]").forEach((card) => {
      const selected = card.dataset.certificateStat === filter.value;
      card.classList.toggle("selected", selected);
      card.setAttribute("aria-pressed", String(selected));
    });
  }

  function updateApplicationStats(visible) {
    document.querySelector("#application-result-count").textContent = `${visible.length}건`;
    document.querySelector("#application-complete-count").textContent = `${visible.filter(({ item }) => item.application_status === "접수완료").length}건`;
    document.querySelector("#application-pending-count").textContent = `${visible.filter(({ item }) => item.application_status.includes("확인 필요")).length}건`;
    document.querySelector("#payment-complete-count").textContent = `${visible.filter(({ item }) => item.payment_status === "완료").length}건`;
  }

  function renderPagination(totalItems, totalPages, startIndex, endIndex) {
    const hasItems = totalItems > 0;
    pageSummary.textContent = hasItems ? `${startIndex + 1}-${endIndex} / 총 ${totalItems}건` : "총 0건";
    previousPageButton.disabled = !hasItems || currentApplicationPage === 1;
    nextPageButton.disabled = !hasItems || currentApplicationPage === totalPages;
    if (!hasItems) {
      pageNumbers.innerHTML = "";
      return;
    }

    let firstPage = Math.max(1, currentApplicationPage - 2);
    let lastPage = Math.min(totalPages, firstPage + 4);
    firstPage = Math.max(1, lastPage - 4);
    pageNumbers.innerHTML = Array.from({ length: lastPage - firstPage + 1 }, (_, offset) => firstPage + offset)
      .map((page) => `<button class="page-button" type="button" data-application-page="${page}" ${page === currentApplicationPage ? 'aria-current="page"' : ""}>${page}</button>`)
      .join("");
  }

  function renderApplications() {
    const query = search.value.trim().toLowerCase();
    const visible = applications.map((item, index) => ({ item, index })).filter(({ item }) => {
      const matchesQuery = !query || item.applicant_name.toLowerCase().includes(query) || item.phone.includes(query) || item.receipt_number.toLowerCase().includes(query);
      return matchesQuery
        && (!sourceFilter.value || item.source === sourceFilter.value)
        && (!filter.value || item.qualification === filter.value)
        && (!statusFilter.value || item.application_status === statusFilter.value);
    });
    const totalPages = Math.max(1, Math.ceil(visible.length / applicationPageSize));
    currentApplicationPage = Math.min(currentApplicationPage, totalPages);
    const startIndex = (currentApplicationPage - 1) * applicationPageSize;
    const endIndex = Math.min(startIndex + applicationPageSize, visible.length);
    const pageItems = visible.slice(startIndex, endIndex);

    applicationBody.innerHTML = pageItems.length ? pageItems.map(({ item, index }) => `
      <tr class="clickable-row application-row" data-index="${index}" tabindex="0" aria-label="${escapeHtml(item.applicant_name)} 접수 상세 보기">
        <td><span class="status-pill ${applicationStatusClass(item.application_status)}">${escapeHtml(item.application_status)}</span></td>
        <td><span class="status-pill">${escapeHtml(item.source)}</span></td>
        <td>${escapeHtml(item.receipt_number)}</td><td>${escapeHtml(item.applied_at)}</td><td><strong>${escapeHtml(item.applicant_name)}</strong></td>
        <td>${escapeHtml(item.phone)}</td><td>${escapeHtml(item.qualification)}</td><td>${escapeHtml(item.exam_date)}</td>
        <td>${escapeHtml(item.exam_center || "-")}</td><td>${escapeHtml(formatFee(item.final_fee))}</td><td>${escapeHtml(item.payment_status)}</td>
      </tr>`).join("") : '<tr><td class="empty" colspan="11">조건에 맞는 기존 접수 이력이 없습니다.</td></tr>';
    bindClickableRows(".application-row", openApplicationDetail);
    updateApplicationStats(visible);
    updateCertificateCardSelection();
    renderPagination(visible.length, totalPages, startIndex, endIndex);
    updateStats();
  }

  function resetApplicationPage() {
    currentApplicationPage = 1;
    renderApplications();
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

  function questionStatusLabel(item) {
    return ({ auto_answered: "자동답변", unanswered: "미답변", answered: "답변작성완료" })[item.answerStatus] || item.answerStatus;
  }

  function updateQuestionStats() {
    document.querySelector("#question-total-count").textContent = `${questions.length}건`;
    document.querySelector("#question-new-count").textContent = `${questions.filter((item) => item.answerStatus === "unanswered").length}건`;
    document.querySelector("#question-auto-count").textContent = `${questions.filter((item) => item.answerStatus === "auto_answered").length}건`;
    document.querySelector("#question-answered-count").textContent = `${questions.filter((item) => item.answerStatus === "answered").length}건`;
  }

  function openQuestionDetail(index) {
    const item = questions[index];
    if (!item) return;
    activeQuestionId = item.id;
    const typeLabels = { answer: "문서 답변", unknown: "모름", restricted: "범위 밖", empty: "빈 질문" };
    const contactLabel = item.contactValue ? `${item.contactMethod === "email" ? "이메일" : "문자"} · ${item.contactValue}` : "연락처 없음";
    document.querySelector("#question-dialog-title").textContent = `${questionStatusLabel(item)} · ${item.id}`;
    document.querySelector("#question-detail").innerHTML = detailItemsHtml([
      { label: "질문 시각", value: formatDate(item.createdAt) },
      { label: "자동응답 구분", value: typeLabels[item.kind] || item.kind },
      { label: "질문", value: item.question, wide: true },
      { label: "챗봇 자동응답", value: item.answer, wide: true },
      { label: "후속 답변 연락처", value: contactLabel },
      { label: "관리자 처리상태", value: questionStatusLabel(item) },
      ...(item.adminAnswer ? [{ label: "관리자 답변", value: item.adminAnswer, wide: true }] : []),
      ...(item.answeredAt ? [{ label: "답변 작성 시각", value: formatDate(item.answeredAt) }] : [])
    ]);
    const canAnswer = item.answerStatus === "unanswered";
    questionAnswerForm.hidden = !canAnswer;
    document.querySelector("#answered-question-actions").hidden = canAnswer;
    document.querySelector("#admin-answer").value = item.adminAnswer || "";
    document.querySelector("#question-answer-status").textContent = item.contactValue ? "답변 저장 후 문자 또는 이메일 앱을 엽니다. 앱에서 최종 전송을 확인해 주세요." : "연락처가 없어 관리자 답변만 저장됩니다.";
    document.querySelector("#send-question-answer").textContent = item.contactValue ? `답변 저장 후 ${item.contactMethod === "email" ? "메일" : "문자"} 앱 열기` : "답변 저장";
    questionDialog.showModal();
  }

  function renderQuestions() {
    const labels = { answer: "문서 답변", unknown: "모름", restricted: "범위 밖", empty: "빈 질문" };
    questionBody.innerHTML = questions.length ? questions.map((item, index) => `<tr class="clickable-row question-row" data-index="${index}" tabindex="0" aria-label="질문 상세 보기"><td>${escapeHtml(formatDate(item.createdAt))}</td><td><strong>${escapeHtml(item.question)}</strong></td><td><span class="status-pill ${item.kind === "answer" ? "new" : ""}">${escapeHtml(labels[item.kind] || item.kind)}</span></td><td><span class="status-pill ${item.answerStatus !== "unanswered" ? "new" : ""}">${escapeHtml(questionStatusLabel(item))}</span></td></tr>`).join("") : '<tr><td class="empty" colspan="4">아직 챗봇 질문 기록이 없습니다.</td></tr>';
    bindClickableRows(".question-row", openQuestionDetail);
    updateQuestionStats();
  }

  async function loadQuestions() {
    questionBody.innerHTML = '<tr><td class="empty" colspan="4">질문 기록을 불러오는 중입니다…</td></tr>';
    try {
      questions = await DuduApi.getQuestions();
      renderQuestions();
    }
    catch (error) { questionBody.innerHTML = `<tr><td class="empty" colspan="4">${escapeHtml(error.message)}</td></tr>`; }
  }

  function showAdminTab(panelId) {
    document.querySelectorAll(".tab-button").forEach((item) => {
      const selected = item.dataset.tab === panelId;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-selected", String(selected));
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => { panel.hidden = panel.id !== panelId; });
    if (panelId === "questions-panel") loadQuestions();
  }

  document.querySelectorAll(".tab-button").forEach((button) => button.addEventListener("click", () => {
    const panelId = button.dataset.tab;
    showAdminTab(panelId);
    document.querySelector(`#${panelId}`).scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  certificateStatCards.addEventListener("click", (event) => {
    const card = event.target.closest("[data-certificate-stat]");
    if (!card) return;
    filter.value = card.dataset.certificateStat;
    showAdminTab("applications-panel");
    resetApplicationPage();
    document.querySelector("#applications-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.querySelector("#show-all-certificates").addEventListener("click", () => {
    filter.value = "";
    showAdminTab("applications-panel");
    resetApplicationPage();
    document.querySelector("#applications-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  search.addEventListener("input", resetApplicationPage);
  sourceFilter.addEventListener("change", resetApplicationPage);
  filter.addEventListener("change", resetApplicationPage);
  statusFilter.addEventListener("change", resetApplicationPage);
  pageSizeSelect.addEventListener("change", () => {
    applicationPageSize = Number(pageSizeSelect.value) || 5;
    resetApplicationPage();
  });
  previousPageButton.addEventListener("click", () => {
    if (currentApplicationPage <= 1) return;
    currentApplicationPage -= 1;
    renderApplications();
  });
  nextPageButton.addEventListener("click", () => {
    currentApplicationPage += 1;
    renderApplications();
  });
  pageNumbers.addEventListener("click", (event) => {
    const button = event.target.closest("[data-application-page]");
    if (!button) return;
    currentApplicationPage = Number(button.dataset.applicationPage);
    renderApplications();
  });

  document.querySelectorAll("[data-close-question]").forEach((button) => button.addEventListener("click", () => questionDialog.close()));

  questionAnswerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = questions.find((question) => question.id === activeQuestionId);
    const answer = document.querySelector("#admin-answer").value.trim();
    const status = document.querySelector("#question-answer-status");
    if (!item || !answer) return;
    const submitButton = document.querySelector("#send-question-answer");
    submitButton.disabled = true;
    status.textContent = "관리자 답변을 저장하고 있습니다…";
    status.className = "form-status";
    try {
      await DuduApi.saveQuestionAnswer(item.id, answer);
      item.adminAnswer = answer;
      item.answerStatus = "answered";
      item.answeredAt = new Date().toISOString();
      renderQuestions();
      if (!item.contactValue) {
        questionDialog.close();
        openQuestionDetail(questions.indexOf(item));
        return;
      }
      const body = `문의: ${item.question}\n\n답변: ${answer}`;
      status.textContent = "답변을 저장했습니다. 열린 앱에서 최종 전송을 확인해 주세요.";
      const target = item.contactMethod === "email"
        ? `mailto:${encodeURIComponent(item.contactValue)}?subject=${encodeURIComponent("두두자격지원센터 문의 답변")}&body=${encodeURIComponent(body)}`
        : `sms:${item.contactValue.replace(/\D/g, "")}?body=${encodeURIComponent(body)}`;
      questionDialog.close();
      window.location.href = target;
    } catch (error) {
      status.textContent = `답변을 저장하지 못했습니다. ${error.message}`;
      status.className = "form-status error";
    } finally {
      submitButton.disabled = false;
    }
  });

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
    const cells = [["접수상태", "출처", "접수번호", "접수일", "이름", "연락처", "자격증", "시험일", "시험장", "최종결제금액", "결제상태"], ...applications.map((item) => [item.application_status, item.source, item.receipt_number, item.applied_at, item.applicant_name, item.phone, item.qualification, item.exam_date, item.exam_center, item.final_fee, item.payment_status])];
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

  function setAdminSettingsOpen(open) {
    adminSettingsMenu.hidden = !open;
    adminSettingsToggle.setAttribute("aria-expanded", String(open));
    adminSettingsToggle.setAttribute("aria-label", open ? "관리자 메뉴 닫기" : "관리자 메뉴 열기");
  }

  adminSettingsToggle.addEventListener("click", () => {
    setAdminSettingsOpen(adminSettingsToggle.getAttribute("aria-expanded") !== "true");
  });
  document.addEventListener("click", (event) => {
    if (!adminSettings.contains(event.target)) setAdminSettingsOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setAdminSettingsOpen(false);
  });
  adminHomeLink.addEventListener("click", () => {
    window.sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
  });

  window.addEventListener("pageshow", () => {
    if (window.sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "true") return;
    document.body.classList.add("admin-auth-mode");
    adminSettings.hidden = true;
    adminHeaderTabs.hidden = true;
    adminAuth.hidden = false;
    adminContent.hidden = true;
    setAdminSettingsOpen(false);
  });

  document.querySelector("#admin-signout").addEventListener("click", () => {
    window.sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
    DuduApi.signOut();
    window.location.reload();
  });

  async function init() {
    const configured = DuduApi.isConfigured();
    if (window.sessionStorage.getItem(ADMIN_UNLOCK_KEY) !== "true") {
      document.body.classList.add("admin-auth-mode");
      adminSettings.hidden = true;
      adminHeaderTabs.hidden = true;
      adminAuth.hidden = false;
      adminContent.hidden = true;
      return;
    }
    document.body.classList.remove("admin-auth-mode");
    adminAuth.hidden = true;
    adminContent.hidden = false;
    adminSettings.hidden = false;
    adminHeaderTabs.hidden = false;
    document.querySelector("#admin-signout").hidden = false;
    if (configured) {
      document.querySelector("#connection-state").textContent = "통합 접수 데이터 조회 · Supabase 연결됨";
    } else {
      document.querySelector("#connection-state").textContent = "오프라인 저장 모드";
    }
    applicationBody.innerHTML = '<tr><td class="empty" colspan="11">세 접수 데이터를 불러오는 중입니다…</td></tr>';
    try {
      const result = await DuduAdminData.loadDraft100("../data/draft_100");
      let newApplications = [];
      let newApplicationError = "";
      try {
        newApplications = DuduAdminData.normalizeApplications(await DuduApi.getApplications());
      } catch (error) {
        newApplicationError = error.message;
      }
      const newReceiptNumbers = new Set(newApplications.map((item) => item.receipt_number));
      applications = [...newApplications, ...result.records.filter((item) => !newReceiptNumbers.has(item.receipt_number))];
      populateFilters();
      renderCertificateStats();
      renderApplications();
      const countText = `통합 총 ${applications.length}건 · 기존 CSV ${result.records.length}건 · 신규 접수 ${newApplications.length}건`;
      const errors = [...result.errors, ...(newApplicationError ? [`Supabase 신규 접수: ${newApplicationError}`] : [])];
      document.querySelector("#draft-load-status").textContent = errors.length ? `${countText} · 로딩 실패: ${errors.join(" / ")}` : `${countText}을 정상적으로 불러왔습니다.`;
    } catch (error) {
      applicationBody.innerHTML = `<tr><td class="empty" colspan="11">기존 접수 데이터 통합조회 실패: ${escapeHtml(error.message)}</td></tr>`;
      document.querySelector("#draft-load-status").textContent = `기존 접수 데이터 통합조회 실패: ${error.message}`;
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
