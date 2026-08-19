const ALLOWED_EVENTS = new Set(["application_submitted", "chatbot_question"]);
const APPLICATION_RESULTS = new Set(["success", "failure"]);
const CHATBOT_RESULTS = new Set(["answer", "unknown", "restricted", "empty", "error"]);

function allowRequest(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store");
}

module.exports = function handler(request, response) {
  allowRequest(response);

  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method Not Allowed" });

  const body = request.body && typeof request.body === "object" ? request.body : {};
  if (!ALLOWED_EVENTS.has(body.event)) {
    return response.status(400).json({ ok: false, error: "지원하지 않는 이벤트입니다." });
  }

  const eventLog = {
    event: body.event,
    timestamp: new Date().toISOString()
  };

  if (body.event === "application_submitted") {
    if (!APPLICATION_RESULTS.has(body.result)) {
      return response.status(400).json({ ok: false, error: "접수 결과값이 올바르지 않습니다." });
    }
    eventLog.receipt_number = String(body.receipt_number || "").slice(0, 64);
    eventLog.certificate = String(body.certificate || "").slice(0, 40);
    eventLog.result = body.result;
  }

  if (body.event === "chatbot_question") {
    if (!CHATBOT_RESULTS.has(body.result_type)) {
      return response.status(400).json({ ok: false, error: "챗봇 결과값이 올바르지 않습니다." });
    }
    eventLog.result_type = body.result_type;
  }

  console.log(JSON.stringify(eventLog));
  return response.status(202).json({ ok: true });
};
