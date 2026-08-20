"""
[rag.py] FAQ 검색 + TF-IDF + FAQ CRUD - 완성형
================================================
Stage 5의 TF-IDF 검색 + Stage 3의 FAQ CRUD를 합친 최종 버전.
FAQ를 추가/삭제하면 TF-IDF 인덱스가 자동 재구축된다.

수정 포인트:
  [R1] min_score를 조정해서 검색 결과 변화를 관찰하세요 (TF-IDF는 0~1 범위)
  [R2] top_k를 늘려서 Gemini에게 여러 근거를 주어보세요
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT.parent / "data" / "faq_combined.jsonl"
SYNONYMS_PATH = ROOT / "synonyms.json"
UNKNOWN = "죄송합니다. 현재 제공된 FAQ에서 확인하기 어려운 내용입니다. 두두자격지원센터에 문의해 주세요."
CLARIFY_CERT = "어떤 자격증을 확인하시나요? 자격증명을 함께 입력해 주세요."
COMMON_CERT = "공통"

CERT_ALIASES = {
    "한식조리기능사": "한식조리",
    "한식조리 기능사": "한식조리",
    "지게차운전기능사": "지게차",
    "지게차 운전기능사": "지게차",
    "굴착기운전기능사": "굴착기",
    "굴착기 운전기능사": "굴착기",
    "전기기능사": "전기",
    "전기 기능사": "전기",
}

CERT_NAMES = (
    "한식조리", "지게차", "굴착기", "전기",
    "공인중개사", "손해평가사", "요양보호사", "위생사",
)

FAQ_INTENT_WORDS = (
    "시험비", "응시료", "접수비", "비용", "금액", "얼마",
    "접수", "신청", "환불", "취소", "합격", "기준", "점수",
    "준비물", "신분증", "수험표", "계산기", "반입", "일정",
    "기간", "응시자격", "자격", "시험장", "과목",
)


def _load_synonyms():
    if not SYNONYMS_PATH.is_file():
        return {}
    return json.loads(SYNONYMS_PATH.read_text(encoding="utf-8"))


def _save_synonyms():
    SYNONYMS_PATH.write_text(
        json.dumps(SYNONYMS, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


SYNONYMS = _load_synonyms()


def get_synonyms_table():
    return [[short, full] for short, full in sorted(SYNONYMS.items())]


def add_synonym(short, full):
    SYNONYMS[short] = full
    _save_synonyms()


def delete_synonym(short):
    if short in SYNONYMS:
        del SYNONYMS[short]
        _save_synonyms()


def _replace_aliases(text, aliases):
    for alias in sorted(aliases, key=len, reverse=True):
        text = re.sub(re.escape(alias), aliases[alias], text, flags=re.IGNORECASE)
    return text


def normalize_question(question):
    normalized = _replace_aliases(question, SYNONYMS)
    normalized = _replace_aliases(normalized, CERT_ALIASES)
    return normalized.strip()


def detect_certificate(question):
    normalized = normalize_question(question)
    return next((cert for cert in CERT_NAMES if cert in normalized), None)


def has_faq_intent(question):
    return any(word in question for word in FAQ_INTENT_WORDS)

def _load_jsonl(path):
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


FAQ = _load_jsonl(DATA_PATH)


def _build_docs(faq_list):
    return [
        f"{r.get('cert', '')} {r.get('category', '')} {r.get('title', '')} {r.get('body', '')} {r.get('reply', '')}"
        for r in faq_list
    ]


vectorizer = TfidfVectorizer()
tfidf_matrix = vectorizer.fit_transform(_build_docs(FAQ))


def rebuild_index():
    """FAQ 변경 후 TF-IDF 인덱스를 재구축한다."""
    global vectorizer, tfidf_matrix
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(_build_docs(FAQ))


def get_faq_count():
    return len(FAQ)


def get_faq_table(query=""):
    """FAQ 목록을 테이블 형태로 반환한다 (최근 50건)."""
    filtered = FAQ
    if query:
        q = query.lower()
        filtered = [r for r in FAQ if
                     q in r.get("cert", "").lower() or
                     q in r.get("category", "").lower() or
                     q in r.get("title", "").lower()]
    rows = [[r.get("id", "?"), r.get("cert", ""), r.get("category", ""), r.get("title", "")] for r in filtered[-50:]]
    return rows


def add_faq_entry(cert, category, title, reply):
    """FAQ 항목을 추가한다."""
    max_id = max((r.get("id", 0) for r in FAQ), default=0)
    if isinstance(max_id, str):
        max_id = len(FAQ)
    entry = {
        "id": max_id + 1,
        "channel": "admin",
        "caller_type": "admin",
        "cert": cert,
        "category": category,
        "title": title,
        "body": title,
        "reply": reply,
        "resolution": "admin_added",
    }
    FAQ.append(entry)


def delete_faq_entry(faq_id):
    """FAQ 항목을 삭제한다."""
    global FAQ
    FAQ = [r for r in FAQ if r.get("id") != faq_id]


def retrieve(question, top_k=3, min_score=0.05):
    normalized_question = normalize_question(question)
    q_vec = vectorizer.transform([normalized_question])
    scores = cosine_similarity(q_vec, tfidf_matrix).flatten()
    top_indices = scores.argsort()[::-1][:top_k]
    return [(float(scores[i]), FAQ[i]) for i in top_indices if scores[i] >= min_score]


def retrieve_common(question, top_k=3, min_score=0.05):
    """자격증명이 없을 때 명시적으로 '공통'으로 등록된 FAQ만 찾는다."""
    common_indices = [i for i, row in enumerate(FAQ) if row.get("cert") == COMMON_CERT]
    if not common_indices:
        return []
    q_vec = vectorizer.transform([normalize_question(question)])
    scores = cosine_similarity(q_vec, tfidf_matrix).flatten()
    top_indices = sorted(common_indices, key=lambda i: scores[i], reverse=True)[:top_k]
    return [(float(scores[i]), FAQ[i]) for i in top_indices if scores[i] >= min_score]


def build_prompt(question, document):
    return f"""당신은 자격증 시험 접수 FAQ 상담원입니다.
아래 근거 안에서만 답하세요. 근거에 없는 내용을 만들지 마세요.
근거로 답할 수 없으면 정확히 UNKNOWN이라고 답하세요.

[질문]
{question}

[근거]
{document.get('reply', document.get('text', ''))}

한국어 두 문장 이내로 답하세요."""


def answer_question(question, generate):
    normalized_question = normalize_question(question)
    certificate = detect_certificate(normalized_question)

    if certificate:
        results = retrieve(normalized_question)
    else:
        results = retrieve_common(normalized_question)
        if not results:
            if has_faq_intent(normalized_question):
                return {"status": "CLARIFY", "answer": CLARIFY_CERT, "source": "없음", "score": 0}
            return {"status": "UNKNOWN", "answer": UNKNOWN, "source": "없음", "score": 0}

    if not results:
        return {"status": "UNKNOWN", "answer": UNKNOWN, "source": "없음", "score": 0}

    best_score, best_doc = results[0]
    generated = generate(build_prompt(question, best_doc)).strip()

    if not generated or generated.upper() == "UNKNOWN":
        return {"status": "UNKNOWN", "answer": UNKNOWN, "source": "없음", "score": best_score}

    return {
        "status": "ANSWERED",
        "answer": generated,
        "source": f"{best_doc.get('cert', 'FAQ')} · {best_doc.get('title') or best_doc.get('category') or 'FAQ'}",
        "score": best_score,
    }
