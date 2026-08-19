(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DuduStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const KEYS = {
    applications: "dudu-applications-v1",
    faqs: "dudu-faqs-v1",
    questions: "dudu-questions-v1"
  };

  function read(key, fallback = []) {
    try {
      const value = root.localStorage && root.localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    if (!root.localStorage) return value;
    root.localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function getApplications() { return read(KEYS.applications, []); }
  function saveApplication(application) {
    const applications = getApplications();
    applications.unshift(application);
    write(KEYS.applications, applications);
    return application;
  }
  function updateApplication(id, changes) {
    const applications = getApplications().map((item) => item.id === id ? { ...item, ...changes } : item);
    return write(KEYS.applications, applications);
  }
  function findApplication(id, phone) {
    const phoneDigits = String(phone || "").replace(/\D/g, "");
    const item = getApplications().find((application) => (
      application.id === String(id || "").trim()
      && String(application.phone || "").replace(/\D/g, "") === phoneDigits
    ));
    if (!item || !phoneDigits) return null;
    const name = String(item.name || "").trim();
    const maskedName = name.length <= 1 ? "*" : (name.length === 2 ? `${name[0]}*` : `${name[0]}*${name[name.length - 1]}`);
    return { id: item.id, createdAt: item.createdAt, name: maskedName, certificate: item.certificate, status: item.status };
  }
  function getFaqs(defaults) { return read(KEYS.faqs, defaults); }
  function saveFaqs(faqs) { return write(KEYS.faqs, faqs); }
  function resetFaqs() {
    if (root.localStorage) root.localStorage.removeItem(KEYS.faqs);
  }
  function getQuestions() { return read(KEYS.questions, []); }
  function saveQuestion(item) {
    const questions = getQuestions();
    questions.unshift(item);
    return write(KEYS.questions, questions.slice(0, 100));
  }
  function saveQuestionAnswer(id, adminAnswer) {
    const questions = getQuestions().map((item) => item.id === id ? {
      ...item,
      adminAnswer,
      answerStatus: "answered",
      answeredAt: new Date().toISOString()
    } : item);
    return write(KEYS.questions, questions);
  }

  return { KEYS, getApplications, saveApplication, updateApplication, findApplication, getFaqs, saveFaqs, resetFaqs, getQuestions, saveQuestion, saveQuestionAnswer };
});
