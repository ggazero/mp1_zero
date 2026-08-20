"""두두자격지원센터 사용자용 공개 FAQ 챗봇."""
from __future__ import annotations

import json
import hmac
import os
from pathlib import Path

# .env 명시적 로드
env_path = Path(__file__).resolve().parent / ".env"
if env_path.is_file():
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        if raw.strip() and not raw.lstrip().startswith("#") and "=" in raw:
            key, value = raw.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())

import gradio as gr

from app import chat
import rag


FAQ_PAGE_SIZE = 10
ADMIN_API_TOKEN = os.environ.get("STAGE6_ADMIN_TOKEN", "").strip()


def require_admin(token):
    if not ADMIN_API_TOKEN:
        raise ValueError("서버에 STAGE6_ADMIN_TOKEN이 설정되지 않았습니다.")
    if not hmac.compare_digest(str(token or ""), ADMIN_API_TOKEN):
        raise ValueError("Stage6 관리 키가 올바르지 않습니다.")


def search_faqs(token, query="", page=1):
    """관리자 화면에 검색된 FAQ 한 페이지만 반환한다."""
    require_admin(token)
    query = str(query or "").strip().lower()
    try:
        page = max(1, int(page))
    except (TypeError, ValueError):
        page = 1

    filtered = rag.FAQ
    if query:
        filtered = [
            item for item in rag.FAQ
            if query in str(item.get("id", "")).lower()
            or query in item.get("cert", "").lower()
            or query in item.get("category", "").lower()
            or query in item.get("title", "").lower()
        ]

    total = len(filtered)
    pages = max(1, (total + FAQ_PAGE_SIZE - 1) // FAQ_PAGE_SIZE)
    page = min(page, pages)
    start = (page - 1) * FAQ_PAGE_SIZE
    items = [
        {
            "id": item.get("id"),
            "cert": item.get("cert", ""),
            "category": item.get("category", ""),
            "title": item.get("title", ""),
            "body": item.get("body", ""),
            "reply": item.get("reply", item.get("text", "")),
        }
        for item in filtered[start:start + FAQ_PAGE_SIZE]
    ]
    return {"items": items, "page": page, "pages": pages, "total": total}


def update_faqs(token, updates):
    """검색 문서는 유지하면서 같은 프로세스의 FAQ 답변을 즉시 수정한다."""
    require_admin(token)
    if isinstance(updates, str):
        updates = json.loads(updates)
    if not isinstance(updates, list):
        raise ValueError("수정할 FAQ 목록이 올바르지 않습니다.")

    by_id = {str(item.get("id")): item for item in rag.FAQ}
    updated_ids = set()
    for change in updates:
        item = by_id.get(str(change.get("id")))
        reply = str(change.get("reply", "")).strip()
        if item is not None and reply:
            group = (item.get("cert"), item.get("category"), item.get("title"))
            for candidate in rag.FAQ:
                candidate_group = (candidate.get("cert"), candidate.get("category"), candidate.get("title"))
                if candidate_group == group:
                    candidate["reply"] = reply
                    updated_ids.add(str(candidate.get("id")))
    return {"ok": True, "updated": len(updated_ids)}


def reset_faqs(token):
    """실행 중 FAQ를 원본 4,705건으로 되돌리고 인덱스를 재구축한다."""
    require_admin(token)
    rag.FAQ[:] = rag._load_jsonl(rag.DATA_PATH)
    rag.rebuild_index()
    return {"ok": True, "count": len(rag.FAQ)}


def list_synonyms(token):
    require_admin(token)
    return {"items": rag.get_synonyms_table()}


def create_synonym(token, short, full):
    require_admin(token)
    short = str(short or "").strip()
    full = str(full or "").strip()
    if not short or not full:
        raise ValueError("줄임말과 정식 명칭을 모두 입력해 주세요.")
    rag.add_synonym(short, full)
    return {"items": rag.get_synonyms_table()}


def remove_synonym(token, short):
    require_admin(token)
    short = str(short or "").strip()
    if not short:
        raise ValueError("삭제할 줄임말을 입력해 주세요.")
    rag.delete_synonym(short)
    return {"items": rag.get_synonyms_table()}


demo = gr.ChatInterface(
    fn=chat,
    title="두두자격지원센터 자격증 시험 FAQ",
    description=(
        f"{rag.get_faq_count():,}건의 FAQ를 바탕으로 안내합니다. "
        "정확한 답변을 위해 자격증명을 함께 입력해 주세요."
    ),
    examples=[
        "한식조리기능사 시험비가 얼마예요?",
        "지게차 접수는 어디서 해요?",
        "요양보호사 합격 기준이 몇 점이에요?",
        "요보사 합격 기준이 몇 점이에요?",
        "공인중개사 환불 규정이 어떻게 되나요?",
    ],
)

# 고객 화면에는 표시하지 않고 기존 /admin/ 화면에서만 호출하는 API입니다.
with demo:
    with gr.Column(visible=False):
        admin_api_token = gr.Textbox(type="password")
        admin_faq_query = gr.Textbox()
        admin_faq_page = gr.Number(value=1)
        admin_faq_result = gr.JSON()
        admin_faq_search = gr.Button()
        admin_faq_updates = gr.JSON()
        admin_faq_update_result = gr.JSON()
        admin_faq_update = gr.Button()
        admin_faq_reset_result = gr.JSON()
        admin_faq_reset = gr.Button()
        admin_synonym_result = gr.JSON()
        admin_synonym_list = gr.Button()
        admin_synonym_short = gr.Textbox()
        admin_synonym_full = gr.Textbox()
        admin_synonym_add = gr.Button()
        admin_synonym_delete = gr.Button()

    admin_faq_search.click(
        search_faqs,
        [admin_api_token, admin_faq_query, admin_faq_page],
        admin_faq_result,
        api_name="admin_faq_search",
    )
    admin_faq_update.click(
        update_faqs,
        [admin_api_token, admin_faq_updates],
        admin_faq_update_result,
        api_name="admin_faq_update",
    )
    admin_faq_reset.click(
        reset_faqs,
        admin_api_token,
        admin_faq_reset_result,
        api_name="admin_faq_reset",
    )
    admin_synonym_list.click(
        list_synonyms,
        admin_api_token,
        admin_synonym_result,
        api_name="admin_synonym_list",
    )
    admin_synonym_add.click(
        create_synonym,
        [admin_api_token, admin_synonym_short, admin_synonym_full],
        admin_synonym_result,
        api_name="admin_synonym_add",
    )
    admin_synonym_delete.click(
        remove_synonym,
        [admin_api_token, admin_synonym_short],
        admin_synonym_result,
        api_name="admin_synonym_delete",
    )


if __name__ == "__main__":
    demo.launch(share=True)
