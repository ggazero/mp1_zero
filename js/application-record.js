(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DuduApplicationRecord = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  const LOOKUP_FAILURE = "입력하신 정보와 일치하는 접수내역을 찾지 못했습니다. 접수번호와 연락처를 다시 확인해 주세요.";
  let successRecord = null;
  let lookupRecord = null;

  function formatPhone(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
    if (digits.length < 4) return digits;
    if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }

  function maskName(value) {
    const name = String(value || "").trim();
    if (name.length <= 1) return "*";
    if (name.length === 2) return `${name[0]}*`;
    return `${name[0]}*${name[name.length - 1]}`;
  }

  function recordText(record, includeStatus = false) {
    const lines = [
      `접수번호: ${record.id}`,
      `이름: ${record.name}`,
      `신청 자격증: ${record.certificate}`,
      `접수 일시: ${formatDate(record.createdAt)}`
    ];
    if (includeStatus) lines.push(`현재 처리 상태: ${record.status}`);
    return lines.join("\n");
  }

  async function copyText(text) {
    if (root.navigator?.clipboard?.writeText) {
      await root.navigator.clipboard.writeText(text);
      return;
    }
    const textarea = root.document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    root.document.body.appendChild(textarea);
    textarea.select();
    const copied = root.document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy failed");
  }

  async function copyWithStatus(text, status, message) {
    try {
      await copyText(text);
      status.textContent = message;
    } catch (_) {
      status.textContent = "복사하지 못했습니다. 다시 시도해 주세요.";
    }
  }

  function showSuccess(application) {
    successRecord = {
      id: application.id,
      name: application.name,
      certificate: application.certificate,
      createdAt: application.createdAt,
      status: application.status
    };
    root.document.querySelector("#success-receipt-number").textContent = successRecord.id;
    root.document.querySelector("#success-name").textContent = successRecord.name;
    root.document.querySelector("#success-certificate").textContent = successRecord.certificate;
    root.document.querySelector("#success-created-at").textContent = formatDate(successRecord.createdAt);
    root.document.querySelector("#success-copy-status").textContent = "";
  }

  function clearSuccess() {
    successRecord = null;
    const status = root.document?.querySelector("#success-copy-status");
    if (status) status.textContent = "";
  }

  function showLookupResult(record) {
    lookupRecord = record;
    root.document.querySelector("#lookup-result-id").textContent = record.id;
    root.document.querySelector("#lookup-result-name").textContent = record.name;
    root.document.querySelector("#lookup-result-certificate").textContent = record.certificate;
    root.document.querySelector("#lookup-result-date").textContent = formatDate(record.createdAt);
    root.document.querySelector("#lookup-result-status").textContent = record.status;
    root.document.querySelector("#lookup-copy-status").textContent = "";
    const result = root.document.querySelector("#lookup-result");
    result.hidden = false;
    result.focus();
  }

  function hideLookupResult() {
    lookupRecord = null;
    root.document.querySelector("#lookup-result").hidden = true;
  }

  function init() {
    if (!root.document?.querySelector("#application-lookup-form")) return;
    const lookupForm = root.document.querySelector("#application-lookup-form");
    const receiptInput = root.document.querySelector("#lookup-receipt-number");
    const phoneInput = root.document.querySelector("#lookup-phone");
    const lookupStatus = root.document.querySelector("#lookup-status");
    const lookupButton = lookupForm.querySelector('[type="submit"]');

    receiptInput.addEventListener("input", () => {
      receiptInput.value = receiptInput.value.trim();
    });
    phoneInput.addEventListener("input", () => { phoneInput.value = formatPhone(phoneInput.value); });
    lookupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      lookupStatus.className = "form-status";
      lookupStatus.textContent = "";
      hideLookupResult();
      const receiptNumber = receiptInput.value.trim();
      const phone = phoneInput.value.trim();
      const phoneDigits = phone.replace(/\D/g, "");

      if (!receiptNumber && !phone) {
        lookupStatus.textContent = "접수번호와 신청 연락처를 입력해주세요.";
        lookupStatus.classList.add("error");
        return;
      }

      if (!receiptNumber) {
        lookupStatus.textContent = "접수번호를 입력해주세요.";
        lookupStatus.classList.add("error");
        return;
      }

      if (!phone) {
        lookupStatus.textContent = "신청 연락처를 입력해주세요.";
        lookupStatus.classList.add("error");
        return;
      }

      if (!/^010\d{8}$/.test(phoneDigits)) {
        lookupStatus.textContent = "신청 연락처 형식을 확인해주세요. (예: 010-1234-5678)";
        lookupStatus.classList.add("error");
        return;
      }

      lookupButton.disabled = true;
      lookupButton.textContent = "접수내용을 확인하고 있습니다…";
      try {
        const record = await root.DuduApi.findApplication(receiptNumber, phone);
        if (!record) {
          lookupStatus.textContent = "일치하는 접수 내역을 찾을 수 없습니다. 접수번호와 신청 연락처를 다시 확인해주세요.";
          lookupStatus.classList.add("error");
          return;
        }
        showLookupResult(record);
      } catch (_) {
        lookupStatus.textContent = "지금은 접수내용을 조회할 수 없습니다. 잠시 후 다시 시도해 주세요.";
        lookupStatus.classList.add("error");
      } finally {
        lookupButton.disabled = false;
        lookupButton.textContent = "접수내용 확인";
      }
    });

    root.document.querySelector("#copy-success-id").addEventListener("click", () => (
      successRecord ? copyWithStatus(successRecord.id, root.document.querySelector("#success-copy-status"), "접수번호를 복사했습니다.") : undefined
    ));
    root.document.querySelector("#copy-success-content").addEventListener("click", () => (
      successRecord ? copyWithStatus(recordText(successRecord), root.document.querySelector("#success-copy-status"), "접수내용을 복사했습니다.") : undefined
    ));
    root.document.querySelector("#print-success").addEventListener("click", () => root.print());
    root.document.querySelector("#copy-lookup-id").addEventListener("click", () => (
      lookupRecord ? copyWithStatus(lookupRecord.id, root.document.querySelector("#lookup-copy-status"), "접수번호를 복사했습니다.") : undefined
    ));
    root.document.querySelector("#copy-lookup-content").addEventListener("click", () => (
      lookupRecord ? copyWithStatus(recordText(lookupRecord, true), root.document.querySelector("#lookup-copy-status"), "접수내용을 복사했습니다.") : undefined
    ));
  }

  init();
  return { LOOKUP_FAILURE, formatPhone, formatDate, maskName, recordText, showSuccess, clearSuccess, init };
});
