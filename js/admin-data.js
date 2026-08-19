(function (root) {
  const FIELD_MAP = {
    national: {
      receipt_number: "접수번호",
      applicant_name: "성명",
      birth_date: "생년월일",
      gender: "성별",
      phone: "연락처",
      qualification: "자격종목",
      exam_region: "시험지역",
      exam_center: "시험장",
      exam_date: "시험일자",
      final_fee: "최종결제금액",
      payment_method: "결제수단",
      payment_status: "결제상태",
      application_status: "접수상태",
      applied_at: "접수일시",
      usage_context: "사용맥락"
    },
    professional: {
      receipt_number: "receipt_no",
      applicant_name: "applicant_name",
      birth_date: "date_of_birth",
      gender: "sex",
      phone: "contact_number",
      qualification: "qualification",
      exam_region: "exam_region",
      exam_center: "exam_center",
      exam_date: "test_date",
      final_fee: "final_amount",
      payment_method: "pay_type",
      payment_status: "pay_status",
      application_status: "app_status",
      applied_at: "registered_at",
      usage_context: "usage_context"
    },
    health: {
      receipt_number: "examNumber",
      applicant_name: "fullName",
      birth_date: "birthday",
      gender: "genderCode",
      phone: "mobile",
      qualification: "certType",
      exam_region: null,
      exam_center: "centerName",
      exam_date: "examDate",
      final_fee: "finalFee",
      payment_method: "payment",
      payment_status: "payResult",
      application_status: "regStatus",
      applied_at: "appliedAt",
      usage_context: "usageContext"
    }
  };

  const SOURCES = [
    { key: "national", label: "국가기술자격", filename: "두두넷_국가기술자격_접수_100.csv" },
    { key: "professional", label: "전문자격", filename: "두두넷_전문자격_접수_100.csv" },
    { key: "health", label: "두두보건", filename: "두두보건_접수_100.csv" }
  ];

  const PAYMENT_METHODS = {
    national: { "신용카드": "신용카드", "계좌이체": "계좌이체", "가상계좌": "가상계좌" },
    professional: { CARD: "신용카드", BANK_TRANSFER: "계좌이체", VIRTUAL_ACCOUNT: "가상계좌" },
    health: { card: "신용카드", transfer: "계좌이체", virtual: "가상계좌" }
  };

  const PAYMENT_STATUSES = {
    national: { "완료": "완료", "환불": "환불", "대기": "대기" },
    professional: { PAID: "완료", REFUNDED: "환불", PENDING: "대기" },
    health: { success: "완료", pending: "대기" }
  };

  const APPLICATION_STATUSES = {
    national: { "접수완료": "접수완료", "취소": "취소", "결제대기": "결제대기" },
    professional: { CONFIRMED: "접수완료", CANCELLED: "취소", PENDING: "확인 필요 (PENDING)" },
    health: { active: "접수완료", pending: "확인 필요 (pending)" }
  };

  function parseCsv(text) {
    const input = String(text || "").replace(/^\uFEFF/, "");
    const matrix = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < input.length; index += 1) {
      const character = input[index];
      if (character === '"') {
        if (quoted && input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === "," && !quoted) {
        row.push(field);
        field = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && input[index + 1] === "\n") index += 1;
        row.push(field);
        if (row.some((value) => value !== "")) matrix.push(row);
        row = [];
        field = "";
      } else {
        field += character;
      }
    }
    if (field !== "" || row.length) {
      row.push(field);
      if (row.some((value) => value !== "")) matrix.push(row);
    }
    if (!matrix.length) return [];

    const headers = matrix.shift().map((header) => header.trim());
    return matrix.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
  }

  function normalizeDate(value) {
    const original = String(value || "").trim();
    const date = original.split(/\s+/)[0];
    let parts;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) parts = date.split("-");
    else if (/^\d{4}\/\d{2}\/\d{2}$/.test(date)) parts = date.split("/");
    else if (/^\d{2}-\d{2}-\d{4}$/.test(date)) {
      const [day, month, year] = date.split("-");
      parts = [year, month, day];
    }
    if (!parts) return original;
    const [year, month, day] = parts.map(Number);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return original;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function normalizePhone(value) {
    const original = String(value || "").trim();
    const digits = original.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("010")) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    return original;
  }

  function mappedValue(group, sourceKey, original) {
    const value = String(original || "").trim();
    return group[sourceKey]?.[value] || value;
  }

  function normalizeGender(sourceKey, value) {
    const original = String(value || "").trim();
    if (sourceKey === "professional") return ({ M: "남", F: "여" })[original] || original;
    return original;
  }

  function normalizeRows(sourceKey, rows) {
    const source = SOURCES.find((item) => item.key === sourceKey);
    const fields = FIELD_MAP[sourceKey];
    if (!source || !fields) throw new Error(`알 수 없는 데이터 출처: ${sourceKey}`);

    return rows.map((row, index) => {
      const get = (commonField) => fields[commonField] ? String(row[fields[commonField]] ?? "").trim() : "";
      const fee = get("final_fee");
      return {
        source: source.label,
        receipt_number: get("receipt_number"),
        applicant_name: get("applicant_name"),
        birth_date: normalizeDate(get("birth_date")),
        gender: normalizeGender(sourceKey, get("gender")),
        phone: normalizePhone(get("phone")),
        qualification: get("qualification"),
        exam_region: get("exam_region"),
        exam_center: get("exam_center"),
        exam_date: normalizeDate(get("exam_date")),
        final_fee: /^\d+$/.test(fee) ? Number(fee) : fee,
        payment_method: mappedValue(PAYMENT_METHODS, sourceKey, get("payment_method")),
        payment_status: mappedValue(PAYMENT_STATUSES, sourceKey, get("payment_status")),
        application_status: mappedValue(APPLICATION_STATUSES, sourceKey, get("application_status")),
        applied_at: normalizeDate(get("applied_at")),
        usage_context: get("usage_context"),
        _row_number: index + 2,
        _raw: { ...row }
      };
    });
  }

  function validateHeaders(sourceKey, rows) {
    if (!rows.length) throw new Error("데이터 행이 없습니다.");
    const headers = Object.keys(rows[0]);
    const required = Object.values(FIELD_MAP[sourceKey]).filter(Boolean);
    const missing = required.filter((header) => !headers.includes(header));
    if (missing.length) throw new Error(`필수 컬럼 누락: ${missing.join(", ")}`);
  }

  async function loadDraft100(basePath = "../data/draft_100") {
    const results = await Promise.all(SOURCES.map(async (source) => {
      const filePath = `${basePath}/${source.filename.normalize("NFD")}`;
      try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const rows = parseCsv(await response.text());
        validateHeaders(source.key, rows);
        return { source, records: normalizeRows(source.key, rows), error: null };
      } catch (error) {
        return { source, records: [], error: `${source.label} (${source.filename}): ${error.message}` };
      }
    }));

    return {
      records: results.flatMap((result) => result.records),
      counts: Object.fromEntries(results.map((result) => [result.source.label, result.records.length])),
      errors: results.map((result) => result.error).filter(Boolean)
    };
  }

  const api = { FIELD_MAP, SOURCES, parseCsv, normalizeDate, normalizePhone, normalizeRows, loadDraft100 };
  root.DuduAdminData = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
