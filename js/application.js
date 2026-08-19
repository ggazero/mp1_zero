(function () {
  const form = document.querySelector("#application-form");
  const certificate = document.querySelector("#certificate");
  const phone = document.querySelector("#phone");
  const status = document.querySelector("#form-status");
  const cards = [...document.querySelectorAll(".cert-card")];
  const successBox = document.querySelector("#success-box");

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
    if (shouldScroll) document.querySelector("#application").scrollIntoView({ behavior: "smooth" });
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
      form.hidden = true;
      if (window.DuduApplicationRecord) window.DuduApplicationRecord.showSuccess(application);
      successBox.classList.add("show");
      successBox.focus();
    } catch (error) {
      showError(`신청을 저장하지 못했습니다. ${error.message}`, submitButton);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "접수 도움 신청하기";
    }
  });

  document.querySelector("#new-application").addEventListener("click", () => {
    form.reset();
    selectCertificate("");
    form.hidden = false;
    successBox.classList.remove("show");
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
