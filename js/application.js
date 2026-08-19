(function () {
  const form = document.querySelector("#application-form");
  const certificate = document.querySelector("#certificate");
  const phone = document.querySelector("#phone");
  const status = document.querySelector("#form-status");
  const cards = [...document.querySelectorAll(".cert-card")];
  const successBox = document.querySelector("#success-box");
  const headerProgress = document.querySelector("#header-progress");
  let applicationCompleted = false;

  function setApplicationProgress(currentStep, mode = "application") {
    if (!headerProgress) return;
    headerProgress.dataset.mode = mode;
    headerProgress.setAttribute("aria-hidden", String(mode === "hidden"));
    headerProgress.querySelectorAll(".header-progress-step").forEach((step) => {
      const stepNumber = Number(step.dataset.step);
      step.classList.toggle("is-done", stepNumber < currentStep);
      step.classList.toggle("is-current", stepNumber === currentStep);
      if (stepNumber === currentStep) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });
  }

  if (typeof window.IntersectionObserver === "function" && headerProgress) {
    const stageObserver = new window.IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      if (visible.target.classList.contains("hero")) setApplicationProgress(0, "hidden");
      else if (visible.target.id === "application-lookup") setApplicationProgress(0, "lookup");
      else if (visible.target.id === "application") setApplicationProgress(applicationCompleted ? 3 : 2);
      else setApplicationProgress(1);
    }, { threshold: [0.55] });
    [".hero", "#certificates", "#application", "#application-lookup"].forEach((selector) => {
      const section = document.querySelector(selector);
      if (section) stageObserver.observe(section);
    });
  }

  function formatPhone(value) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length < 4) return digits;
    if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  function selectCertificate(value, shouldScroll = false) {
    certificate.value = value;
    cards.forEach((card) => {
      const selected = card.dataset.certificate === value;
      card.classList.toggle("selected", selected);
      card.setAttribute("aria-checked", String(selected));
    });
    if (shouldScroll) {
      setApplicationProgress(2);
      document.querySelector("#application").scrollIntoView({ behavior: "smooth" });
    }
  }

  cards.forEach((card) => card.addEventListener("click", () => selectCertificate(card.dataset.certificate, true)));
  certificate.addEventListener("change", () => selectCertificate(certificate.value));
  phone.addEventListener("input", () => { phone.value = formatPhone(phone.value); });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.className = "form-status";
    const name = form.elements.name.value.trim();
    const phoneDigits = phone.value.replace(/\D/g, "");

    if (!certificate.value) return showError("신청할 자격증을 선택해 주세요.", certificate);
    if (name.length < 2) return showError("이름을 두 글자 이상 입력해 주세요.", form.elements.name);
    if (!/^01\d{8,9}$/.test(phoneDigits)) return showError("연락처를 정확히 입력해 주세요.", phone);
    if (!document.querySelector("#privacy").checked) return showError("개인정보 수집 동의가 필요합니다.", document.querySelector("#privacy"));

    const now = new Date();
    const day = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map((value) => String(value).padStart(2, "0")).join("");
    const application = {
      id: `DUDU-${day}-${time}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
      createdAt: now.toISOString(),
      name,
      phone: formatPhone(phoneDigits),
      certificate: certificate.value,
      channel: "웹",
      note: form.elements.note.value.trim(),
      status: "신규"
    };
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "신청을 저장하고 있습니다…";
    try {
      await DuduApi.saveApplication(application);
      DuduApi.sendEvent({
        event: "application_submitted",
        receipt_number: application.id,
        certificate: application.certificate,
        result: "success",
        timestamp: new Date().toISOString()
      }).catch(() => {});
      form.hidden = true;
      if (window.DuduApplicationRecord) window.DuduApplicationRecord.showSuccess(application);
      successBox.classList.add("show");
      applicationCompleted = true;
      setApplicationProgress(3);
      successBox.focus();
    } catch (error) {
      DuduApi.sendEvent({
        event: "application_submitted",
        receipt_number: application.id,
        certificate: application.certificate,
        result: "failure",
        timestamp: new Date().toISOString()
      }).catch(() => {});
      setApplicationProgress(2);
      showError(`신청을 저장하지 못했습니다. ${error.message}`, submitButton);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "새 접수 신청하기";
    }
  });

  document.querySelector("#new-application").addEventListener("click", () => {
    form.reset();
    applicationCompleted = false;
    selectCertificate("");
    form.hidden = false;
    successBox.classList.remove("show");
    setApplicationProgress(2);
    if (window.DuduApplicationRecord) window.DuduApplicationRecord.clearSuccess();
    status.textContent = "";
    certificate.focus();
  });

  function showError(message, field) {
    status.textContent = message;
    status.classList.add("error");
    field.focus();
  }
})();
