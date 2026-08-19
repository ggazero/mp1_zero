(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DuduKnowledge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const UNKNOWN = "죄송합니다. 제공된 안내 문서에서 확인되지 않는 내용입니다. 두두자격지원센터에 문의해 주세요.";
  const PRACTICAL = "저희는 필기 시험 접수와 안내만 도와드립니다. 실기 시험은 안내 범위가 아닙니다.";

  const DEFAULT_FAQS = [
    {
      id: "fee-cook",
      category: "응시료",
      title: "한식조리기능사 필기 응시료",
      keywords: ["한식", "한식조리", "한식조리기능사", "응시료", "접수비", "시험비", "돈", "금액"],
      answer: "한식조리기능사 필기 응시료는 14,500원입니다."
    },
    {
      id: "schedule-cook",
      category: "접수 일정",
      title: "한식조리기능사 접수 시기",
      keywords: ["한식", "한식조리", "한식조리기능사", "언제", "일정", "접수", "신청"],
      answer: "한식조리기능사는 상시 종목으로 정해진 접수 기간이 없습니다. 두두넷에서 시험장 자리가 있을 때 접수할 수 있습니다."
    },
    {
      id: "schedule-care",
      category: "접수 일정",
      title: "요양보호사 접수 시기",
      keywords: ["요양", "요양사", "요양보호사", "언제", "일정", "접수", "신청"],
      answer: "요양보호사는 상시 시험이며 시험일 7일 전까지 접수합니다. 시험일은 센터마다 다릅니다."
    },
    {
      id: "schedule-realtor",
      category: "접수 일정",
      title: "공인중개사 1차 접수 일정",
      keywords: ["공인중개", "공인중개사", "부동산", "언제", "일정", "접수", "신청", "1차"],
      answer: "2026년 공인중개사 제37회 1차 접수는 8월 3일부터 8월 7일까지로 종료되었습니다. 빈자리 추가접수는 10월 1일부터 10월 2일까지입니다."
    },
    {
      id: "place-cook",
      category: "접수 방법",
      title: "한식조리기능사 접수처",
      keywords: ["한식", "한식조리", "한식조리기능사", "어디", "접수처", "사이트", "신청"],
      answer: "한식조리기능사는 두두넷에서 오전 10시부터 온라인으로 접수합니다. 방문 접수는 없습니다."
    },
    {
      id: "place-care",
      category: "접수 방법",
      title: "요양보호사 접수처",
      keywords: ["요양", "요양사", "요양보호사", "어디", "접수처", "사이트", "신청"],
      answer: "요양보호사는 두두보건 상시시험 사이트에서 접수합니다."
    },
    {
      id: "place-realtor",
      category: "접수 방법",
      title: "공인중개사 접수처",
      keywords: ["공인중개", "공인중개사", "부동산", "어디", "접수처", "사이트", "신청"],
      answer: "공인중개사는 두두넷 공인중개사 전용 사이트에서 오전 9시부터 접수합니다."
    },
    {
      id: "preparation",
      category: "준비 사항",
      title: "온라인 접수 준비물",
      keywords: ["준비", "준비물", "사진", "회원가입", "인증서", "접수"],
      answer: "접수 전에 회원가입, 공동인증서 또는 금융인증서, 6개월 이내 촬영한 3.5×4.5cm 컬러 증명사진을 준비해 주세요."
    },
    {
      id: "exam-items",
      category: "시험 안내",
      title: "필기시험 준비물",
      keywords: ["필기", "1차", "이론", "시험", "당일", "준비물", "신분증", "수험표"],
      answer: "필기시험 당일에는 수험표, 신분증, 필기구를 준비해 주세요. 휴대폰과 스마트워치 등 통신기기는 반입할 수 없습니다."
    },
    {
      id: "refund",
      category: "결제·환불",
      title: "응시료 환불 기준",
      keywords: ["환불", "취소", "돌려", "응시료", "접수비"],
      answer: "접수기간 내 취소는 100%, 접수기간 후부터 해당 회차 시험 시작 5일 전까지는 50% 환불됩니다. 시험 시작 4일 전부터는 환불되지 않습니다."
    }
  ];

  const normalize = (value) => String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[?!.,~·]/g, "");

  function answerQuestion(question, faqs = DEFAULT_FAQS) {
    const normalized = normalize(question);
    if (!normalized) return { answer: "질문을 입력해 주세요.", source: null, confidence: 0, kind: "empty" };

    if (/(실기|2차|실습|직접하는)/.test(normalized)) {
      return { answer: PRACTICAL, source: "안내규정: 필기 접수 한정", confidence: 1, kind: "restricted" };
    }

    const explicitUnknown = [
      /(요양|요양사|요양보호사).*(응시료|접수비|시험비|금액|얼마|돈)/,
      /(공인중개|부동산).*(응시료|접수비|시험비|금액|얼마|돈)/,
      /(교육시간|교육이수|응시자격).*(요양|요양사|요양보호사)/,
      /(요양|요양사|요양보호사).*(교육시간|교육이수|응시자격)/,
      /(주차|합격할|붙을|동시|같이딸)/
    ];
    if (explicitUnknown.some((pattern) => pattern.test(normalized))) {
      return { answer: UNKNOWN, source: null, confidence: 0, kind: "unknown" };
    }

    let best = null;
    for (const faq of faqs) {
      const hits = (faq.keywords || []).filter((keyword) => normalized.includes(normalize(keyword)));
      const certificateHit = hits.some((word) => /한식|요양|공인중개|부동산/.test(word));
      const intentHit = hits.some((word) => /응시료|접수비|시험비|돈|금액|언제|일정|접수|신청|어디|접수처|사이트|준비|사진|신분증|수험표|환불|취소/.test(word));
      const score = hits.length + (certificateHit ? 2 : 0) + (intentHit ? 1 : 0);
      if (!best || score > best.score) best = { faq, score, hits };
    }

    if (!best || best.score < 3) {
      return { answer: UNKNOWN, source: null, confidence: 0, kind: "unknown" };
    }
    return {
      answer: best.faq.answer,
      source: `FAQ: ${best.faq.title}`,
      confidence: Math.min(1, best.score / 7),
      kind: "answer"
    };
  }

  return { DEFAULT_FAQS, UNKNOWN, PRACTICAL, normalize, answerQuestion };
});
