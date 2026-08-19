(function (root) {
  const config = root.DUDU_CONFIG || {};
  const url = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = String(config.SUPABASE_ANON_KEY || "");
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
      body: JSON.stringify({ id: item.id, question: item.question, answer: item.answer, kind: item.kind })
    });
  }

  async function getQuestions() {
    if (!isConfigured()) return DuduStorage.getQuestions();
    const rows = await request("/rest/v1/question_logs?select=*&order=created_at.desc&limit=100");
    return rows.map((row) => ({ id: row.id, question: row.question, answer: row.answer, kind: row.kind, createdAt: row.created_at }));
  }

  root.DuduApi = { isConfigured, getSession, signIn, signOut, saveApplication, getApplications, updateApplication, getFaqs, saveFaqs, resetFaqs, saveQuestion, getQuestions };
})(window);
