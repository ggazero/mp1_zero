"""안내규정에 근거한 두두자격지원센터 Gradio FAQ 챗봇."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Callable


BASE_DIR = Path(__file__).resolve().parent
FAQ_PATH = BASE_DIR / "chatbot_faq.json"

UNKNOWN = (
    "죄송합니다. 제공된 안내 문서에서 확인되지 않는 내용입니다. "
    "두두자격지원센터에 문의해 주세요."
)
PRACTICAL = (
    "저희는 필기 시험 접수와 안내만 도와드립니다. "
    "실기 시험은 안내 범위가 아닙니다."
)
EMPTY = "질문을 입력해 주세요."

CERTIFICATE_WORDS = ("한식", "요양", "공인중개", "부동산")
INTENT_WORDS = (
    "응시료", "접수비", "시험비", "돈", "금액", "얼마",
    "언제", "시기", "일정", "접수", "신청", "어디", "접수처",
    "사이트", "준비", "사진", "신분증", "수험표", "환불", "취소",
)


def load_knowledge(path: Path = FAQ_PATH) -> dict[str, Any]:
    """검수된 공개용 FAQ 데이터만 읽는다."""
    with path.open(encoding="utf-8") as file:
        payload = json.load(file)
    if not isinstance(payload.get("faqs"), list) or not payload["faqs"]:
        raise ValueError("FAQ 데이터가 비어 있습니다.")
    return payload


KNOWLEDGE = load_knowledge()
FAQS = KNOWLEDGE["faqs"]
THRESHOLD = int(KNOWLEDGE.get("threshold", 3))


def normalize(value: str) -> str:
    """JS 챗봇과 같은 수준으로 질문을 정리한다."""
    normalized = str(value or "").lower()
    normalized = re.sub(r"\s+", "", normalized)
    return re.sub(r"[?!.,~·]", "", normalized)


def has_any(text: str, words: tuple[str, ...]) -> bool:
    return any(normalize(word) in text for word in words)


def is_practical_question(question: str) -> bool:
    return bool(re.search(r"실기|2차|실습|직접하", question))


def forced_unknown_reason(question: str) -> str | None:
    """안내규정 9절의 미확인 8개 항목을 FAQ 검색 전에 거절한다."""
    fee_words = ("응시료", "접수비", "시험비", "금액", "얼마", "돈")

    fee_certificates = (
        (("요양", "요양사", "요양보호사"), "요양보호사 응시료"),
        (("위생사",), "위생사 응시료"),
        (("손해평가", "손해평가사"), "손해평가사 1차 응시료"),
        (("공인중개", "공인중개사", "부동산"), "공인중개사 1차 응시료"),
    )
    for certificate_words, reason in fee_certificates:
        if has_any(question, certificate_words) and has_any(question, fee_words):
            return reason

    if (
        has_any(question, ("요양", "요양사", "요양보호사"))
        and has_any(question, ("응시자격", "자격조건", "교육시간", "교육이수", "이수시간"))
    ):
        return "요양보호사 응시자격"

    if "위생사" in question and has_any(question, ("일정", "시험일", "언제", "시험날짜")):
        return "위생사 시험 일정"

    if (
        "상시" in question
        and has_any(question, ("실제", "정확히", "어디", "신청처", "접수처", "사이트"))
        and has_any(question, ("신청", "접수", "어디", "신청처", "접수처", "사이트"))
    ):
        return "상시 종목 실제 신청처"

    if (
        has_any(question, ("공인중개", "공인중개사", "부동산"))
        and "면제" in question
    ):
        return "공인중개사 1차 면제기간"

    return None


def is_other_unknown(question: str) -> bool:
    """발주서에서 답할 수 없다고 명시한 일반 질문."""
    return bool(re.search(r"주차|합격할|붙을|동시|같이딸", question))


def choose_faq(question: str) -> tuple[dict[str, Any] | None, int, list[str]]:
    best_faq: dict[str, Any] | None = None
    best_score = -1
    best_hits: list[str] = []

    for faq in FAQS:
        hits = [keyword for keyword in faq.get("keywords", []) if normalize(keyword) in question]
        certificate_hit = any(has_any(normalize(word), CERTIFICATE_WORDS) for word in hits)
        intent_hit = any(has_any(normalize(word), INTENT_WORDS) for word in hits)
        score = len(hits) + (2 if certificate_hit else 0) + (1 if intent_hit else 0)
        if score > best_score:
            best_faq = faq
            best_score = score
            best_hits = hits

    return best_faq, best_score, best_hits


def classify_question(question: str) -> dict[str, Any]:
    """빈 질문 → 실기 → 강제 거절 → FAQ → threshold 순서로 판정한다."""
    normalized = normalize(question)
    if not normalized:
        return {"answer": EMPTY, "kind": "empty", "source": None, "score": 0}

    if is_practical_question(normalized):
        return {
            "answer": PRACTICAL,
            "kind": "restricted",
            "source": "02_안내규정.md: 필기 접수 한정",
            "score": 0,
        }

    unknown_reason = forced_unknown_reason(normalized)
    if unknown_reason:
        return {
            "answer": UNKNOWN,
            "kind": "unknown",
            "source": f"02_안내규정.md 9절: {unknown_reason}",
            "score": 0,
        }

    if is_other_unknown(normalized):
        return {"answer": UNKNOWN, "kind": "unknown", "source": None, "score": 0}

    faq, score, hits = choose_faq(normalized)
    if faq is None or score < THRESHOLD:
        return {"answer": UNKNOWN, "kind": "unknown", "source": None, "score": score}

    return {
        "answer": faq["answer"],
        "kind": "answer",
        "source": faq.get("source_section"),
        "score": score,
        "hits": hits,
    }


def answer_question(question: str) -> str:
    return classify_question(question)["answer"]


def gradio_reply(message: str, history: list[dict[str, Any]] | None = None) -> str:
    del history
    result = classify_question(message)
    source = result.get("source")
    if source and result["kind"] == "answer":
        return f"{result['answer']}\n\n근거: {source}"
    return result["answer"]


def build_demo() -> Any:
    import gradio as gr

    return gr.ChatInterface(
        fn=gradio_reply,
        title="두두자격지원센터 FAQ 상담",
        description=(
            "필기 접수 안내규정에서 확인된 내용만 답변합니다. "
            "확인되지 않은 내용과 실기 시험은 안내하지 않습니다."
        ),
        examples=[
            "한식조리기능사 필기 응시료 얼마예요?",
            "요양보호사 접수 시기는 언제예요?",
            "필기시험 준비물 뭐예요?",
            "환불은 언제까지 돼요?",
        ],
    )


TestCheck = Callable[[dict[str, Any]], bool]


def contains(*parts: str) -> TestCheck:
    return lambda result: all(part in result["answer"] for part in parts)


def kind_is(kind: str) -> TestCheck:
    return lambda result: result["kind"] == kind


TEST_CASES: list[tuple[str, str, str, TestCheck]] = [
    ("한식조리기능사 필기 응시료 얼마예요?", "14,500원", "정답", contains("14,500원")),
    ("한식 접수비 얼마야?", "14,500원", "정답", contains("14,500원")),
    ("요양보호사 접수 시기는 언제예요?", "시험일 7일 전", "정답", contains("7일 전")),
    ("필기시험 준비물 뭐예요?", "수험표·신분증·필기구", "정답", contains("수험표", "신분증", "필기구")),
    ("환불은 언제까지 돼요?", "환불 기준 안내", "정답", contains("100%", "50%", "4일 전")),
    ("요양보호사 응시료 얼마예요?", "모름", "강제 거절 1", kind_is("unknown")),
    ("위생사 응시료 얼마예요?", "모름", "강제 거절 2", kind_is("unknown")),
    ("손해평가사 1차 응시료 얼마예요?", "모름", "강제 거절 3", kind_is("unknown")),
    ("공인중개사 1차 응시료 얼마예요?", "모름", "강제 거절 4", kind_is("unknown")),
    ("요양보호사 응시자격이 어떻게 돼요?", "모름", "강제 거절 5", kind_is("unknown")),
    ("위생사 시험 일정은 언제예요?", "모름", "강제 거절 6", kind_is("unknown")),
    ("상시 종목은 실제 어디에서 신청해요?", "모름", "강제 거절 7", kind_is("unknown")),
    ("공인중개사 1차 면제는 몇 년이에요?", "모름", "강제 거절 8", kind_is("unknown")),
    ("한식 실기 준비물 알려줘", "필기 접수만 안내", "범위 밖", kind_is("restricted")),
    ("2차 시험 어떻게 접수해요?", "필기 접수만 안내", "범위 밖", kind_is("restricted")),
    ("", "질문 입력 요청", "빈 질문", kind_is("empty")),
]


def run_tests() -> int:
    failures = 0
    print("| 질문 | 기대 결과 | 실제 결과 | PASS/FAIL |")
    print("| -- | -- | -- | -- |")
    for question, expected, _category, check in TEST_CASES:
        result = classify_question(question)
        passed = check(result)
        failures += 0 if passed else 1
        display_question = question or "(빈 질문)"
        actual = result["answer"].replace("|", "\\|").replace("\n", " ")
        print(f"| {display_question} | {expected} | {actual} | {'PASS' if passed else 'FAIL'} |")
    print(f"\n총 {len(TEST_CASES)}건 · PASS {len(TEST_CASES) - failures}건 · FAIL {failures}건")
    return 1 if failures else 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="두두자격지원센터 Gradio FAQ 챗봇")
    parser.add_argument("--test", action="store_true", help="기본 및 강제 거절 테스트 실행")
    parser.add_argument("--port", type=int, default=7860, help="로컬 실행 포트")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.test:
        return run_tests()
    demo = build_demo()
    demo.launch(server_name="127.0.0.1", server_port=args.port, show_error=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
