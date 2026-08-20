(function (root) {
  const config = root.DUDU_CONFIG || {};
  const url = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = String(config.SUPABASE_ANON_KEY || "");
  const stage6Url = String(config.STAGE6_API_URL || "").replace(/\/$/, "");
  const SESSION_KEY = "dudu-admin-session-v1";

  function isConfigured() {
    return /^https:\/\/.+\.supabase\.co$/.test(url) && anonKey.length > 20;
  }

  function getSession() {
    try {
      const session = JSON.parse(root.sessionStorage.getItem(SESSION_KEY) || "null");
      if (!session || !session.access_token || (session.expires_at && session.expires_at * 1000 < Date.now())) return null;
      return session;
    } catch (_) {
      return null;
    }
  }

  function setSession(session) {
    const normalized = { ...session, expires_at: session.expires_at || Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600) };
    root.sessionStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function signOut() {
    root.sessionStorage.removeItem(SESSION_KEY);
  }

  async function request(path, options = {}) {
    if (!isConfigured()) throw new Error("Supabase 설정이 필요합니다.");
    const session = getSession();
    const response = await fetch(`${url}${path}`, {
      ...options,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session?.access_token || anonKey}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.message || detail.error_description || detail.hint || `요청 실패 (${response.status})`);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function sendEvent(event) {
    const response = await fetch("/api/events/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true
    });
    if (!response.ok) throw new Error(`이벤트 기록 실패 (${response.status})`);
    return response.json();
  }

  async function stage6Request(apiName, data = []) {
    if (!stage6Url) throw new Error("Stage6 챗봇 주소가 설정되지 않았습니다.");
    const submit = await fetch(`${stage6Url}/gradio_api/call/${apiName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data })
    });
    if (!submit.ok) throw new Error(`Stage6 요청 실패 (${submit.status})`);
    const { event_id: eventId } = await submit.json();
    if (!eventId) throw new Error("Stage6 작업 번호를 받지 못했습니다.");

    const result = await fetch(`${stage6Url}/gradio_api/call/${apiName}/${eventId}`);
    if (!result.ok) throw new Error(`Stage6 결과 조회 실패 (${result.status})`);
    const body = await result.text();
    let eventType = "";
    for (const line of body.split("\n")) {
      if (line.startsWith("event: ")) eventType = line.slice(7);
      if (!line.startsWith("data: ")) continue;
      const payload = JSON.parse(line.slice(6));
      if (eventType === "error") throw new Error(String(payload || "Stage6 요청을 처리하지 못했습니다."));
      if (eventType === "complete") return payload[0];
    }
    throw new Error("Stage6 응답을 읽지 못했습니다.");
  }

  function searchStage6Faqs(token, query = "", page = 1) {
    return stage6Request("admin_faq_search", [token, query, page]);
  }

  function saveStage6Faqs(token, updates) {
    return stage6Request("admin_faq_update", [token, updates]);
  }

  function resetStage6Faqs(token) {
    return stage6Request("admin_faq_reset", [token]);
  }

  function getStage6Synonyms(token) {
    return stage6Request("admin_synonym_list", [token]);
  }

  function addStage6Synonym(token, short, full) {
    return stage6Request("admin_synonym_add", [token, short, full]);
  }

  function deleteStage6Synonym(token, short) {
    return stage6Request("admin_synonym_delete", [token, short]);
  }

  async function signIn(email, password) {
    if (!isConfigured()) throw new Error("먼저 Supabase URL과 anon key를 설정해 주세요.");
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error_description || payload.msg || "로그인에 실패했습니다.");
    return setSession(payload);
  }

  function toApplication(row) {
    return {
      id: row.id,
      createdAt: row.created_at,
      name: row.name,
      phone: row.phone,
      certificate: row.certificate,
      channel: row.channel,
      note: row.note || "",
      status: row.status
    };
  }

  function toFaq(row) {
    return { id: row.id, category: row.category, title: row.title, keywords: row.keywords, answer: row.answer };
  }

  async function saveApplication(application) {
    if (!isConfigured()) return DuduStorage.saveApplication(application);
    await request("/rest/v1/applications", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: application.id,
        name: application.name,
        phone: application.phone,
        certificate: application.certificate,
        channel: application.channel,
        note: application.note,
        status: application.status
      })
    });
    return application;
  }

  async function getApplications() {
    if (!isConfigured()) return DuduStorage.getApplications();
    const rows = await request("/rest/v1/applications?select=*&order=created_at.desc");
    return rows.map(toApplication);
  }

  async function updateApplication(id, changes) {
    if (!isConfigured()) return DuduStorage.updateApplication(id, changes);
    const body = {};
    if (changes.status) body.status = changes.status;
    return request(`/rest/v1/applications?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(body)
    });
  }

  async function findApplication(id, phone) {
    if (!isConfigured()) return DuduStorage.findApplication(id, phone);
    const rows = await request("/rest/v1/rpc/lookup_application", {
      method: "POST",
      body: JSON.stringify({ p_receipt_number: String(id || "").trim(), p_phone: String(phone || "").trim() })
    });
    const row = rows?.[0];
    if (!row) return null;
    return {
      id: row.id,
      createdAt: row.created_at,
      name: row.masked_name,
      certificate: row.certificate,
      status: row.status
    };
  }

  async function getFaqs(defaults) {
    if (!isConfigured()) return DuduStorage.getFaqs(defaults);
    const rows = await request("/rest/v1/faq_entries?select=*&order=sort_order.asc");
    return rows.length ? rows.map(toFaq) : defaults;
  }

  async function saveFaqs(faqs) {
    if (!isConfigured()) return DuduStorage.saveFaqs(faqs);
    return request("/rest/v1/faq_entries?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(faqs.map((faq, index) => ({ ...faq, sort_order: index })))
    });
  }

  async function resetFaqs(defaults) {
    if (!isConfigured()) return DuduStorage.resetFaqs();
    return saveFaqs(defaults);
  }

  async function saveQuestion(item) {
    if (!isConfigured()) return DuduStorage.saveQuestion(item);
    return request("/rest/v1/question_logs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: item.id,
        question: item.question,
        answer: item.answer,
        kind: item.kind,
        contact_method: item.contactMethod || null,
        contact_value: item.contactValue || null,
        answer_status: item.answerStatus || (item.kind === "answer" ? "auto_answered" : "unanswered")
      })
    });
  }

  async function getQuestions() {
    if (!isConfigured()) return DuduStorage.getQuestions().map((item) => ({
      ...item,
      contactMethod: item.contactMethod || "",
      contactValue: item.contactValue || "",
      adminAnswer: item.adminAnswer || "",
      answerStatus: item.answerStatus || (item.kind === "answer" ? "auto_answered" : "unanswered"),
      answeredAt: item.answeredAt || ""
    }));
    const rows = await request("/rest/v1/question_logs?select=*&order=created_at.desc&limit=100");
    return rows.map((row) => ({
      id: row.id,
      question: row.question,
      answer: row.answer,
      kind: row.kind,
      createdAt: row.created_at,
      contactMethod: row.contact_method || "",
      contactValue: row.contact_value || "",
      adminAnswer: row.admin_answer || "",
      answerStatus: row.answer_status || (row.kind === "answer" ? "auto_answered" : "unanswered"),
      answeredAt: row.answered_at || ""
    }));
  }

  async function saveQuestionAnswer(id, adminAnswer) {
    if (!isConfigured()) return DuduStorage.saveQuestionAnswer(id, adminAnswer);
    return request(`/rest/v1/question_logs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ admin_answer: adminAnswer, answer_status: "answered", answered_at: new Date().toISOString() })
    });
  }

  root.DuduApi = {
    isConfigured, getSession, signIn, signOut, sendEvent,
    saveApplication, getApplications, updateApplication, findApplication,
    getFaqs, saveFaqs, resetFaqs, saveQuestion, getQuestions, saveQuestionAnswer,
    searchStage6Faqs, saveStage6Faqs, resetStage6Faqs,
    getStage6Synonyms, addStage6Synonym, deleteStage6Synonym
  };
})(window);
