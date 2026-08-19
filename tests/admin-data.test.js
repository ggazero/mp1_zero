const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { SOURCES, parseCsv, normalizeRows, loadDraft100, getSourceDetailFields } = require("../js/admin-data.js");

function readSource(source) {
  const filePath = path.join(__dirname, "..", "data", "draft_100", source.filename.normalize("NFD"));
  const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
  return normalizeRows(source.key, rows);
}

const recordsBySource = Object.fromEntries(SOURCES.map((source) => [source.key, readSource(source)]));

test("draft_100 세 파일을 50/20/30건으로 읽는다", () => {
  assert.equal(recordsBySource.national.length, 50);
  assert.equal(recordsBySource.professional.length, 20);
  assert.equal(recordsBySource.health.length, 30);
  assert.equal(Object.values(recordsBySource).flat().length, 100);
});

test("전문자격 코드와 날짜를 관리자 표시값으로 정규화한다", () => {
  const sample = recordsBySource.professional[0];
  assert.equal(sample.source, "전문자격");
  assert.equal(sample.birth_date, "1966-07-09");
  assert.equal(sample.exam_date, "2026-10-18");
  assert.equal(sample.payment_method, "계좌이체");
  assert.equal(sample.payment_status, "완료");
  assert.equal(sample.application_status, "접수완료");
});

test("두두보건 날짜와 연락처만 표시용으로 바꾸고 원본은 보존한다", () => {
  const sample = recordsBySource.health[0];
  assert.equal(sample.birth_date, "1948-06-12");
  assert.equal(sample.exam_date, "2026-10-13");
  assert.equal(sample.phone, "010-1857-6482");
  assert.equal(sample.payment_method, "가상계좌");
  assert.equal(sample._raw.mobile, "01018576482");
  assert.equal(sample._raw.examDate, "13-10-2026");
});

test("근거 없는 두두보건 성별 1/2는 변환하지 않는다", () => {
  assert.deepEqual([...new Set(recordsBySource.health.map((item) => item.gender))].sort(), ["1", "2"]);
});

test("출처별 추가 상세 필드를 한국어 라벨로 제공한다", () => {
  const professional = getSourceDetailFields(recordsBySource.professional[0]);
  const health = getSourceDetailFields(recordsBySource.health[0]);
  assert.equal(professional.find((item) => item.label === "시험과목").value, "부동산학개론;민법및민사특별법");
  assert.equal(health.find((item) => item.label === "교육기관").value, "제주시니어교육원");
  assert.equal(professional.some((item) => item.label.includes("_")), false);
});

test("의미가 불명확한 접수 대기 코드는 확인 필요로 표시한다", () => {
  const professional = recordsBySource.professional.find((item) => item._raw.app_status === "PENDING");
  const health = recordsBySource.health.find((item) => item._raw.regStatus === "pending");
  assert.equal(professional.application_status, "확인 필요 (PENDING)");
  assert.equal(health.application_status, "확인 필요 (pending)");
});

test("특정 CSV 로딩 실패 시 출처와 파일명을 오류에 표시한다", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const source = SOURCES.find((item) => String(url).includes(item.filename.normalize("NFD")));
    if (source.key === "professional") return { ok: false, status: 404 };
    const filePath = path.join(__dirname, "..", "data", "draft_100", source.filename.normalize("NFD"));
    return { ok: true, text: async () => fs.readFileSync(filePath, "utf8") };
  };
  try {
    const result = await loadDraft100("/draft_100");
    assert.equal(result.records.length, 80);
    assert.match(result.errors[0], /전문자격/);
    assert.match(result.errors[0], /두두넷_전문자격_접수_100\.csv/);
  } finally {
    global.fetch = originalFetch;
  }
});
