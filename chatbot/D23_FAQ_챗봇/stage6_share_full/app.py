"""두두자격지원센터 FAQ 챗봇과 FAQ·동의어 관리 화면."""
from __future__ import annotations
import os
from pathlib import Path
import gradio as gr
from gemini import GeminiClient
from rag import (
    answer_question, rebuild_index, get_faq_table, add_faq_entry, delete_faq_entry,
    get_faq_count, get_synonyms_table, add_synonym, delete_synonym,
)


def load_env():
    path = Path(__file__).resolve().parent / ".env"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        if raw.strip() and not raw.lstrip().startswith("#") and "=" in raw:
            key, value = raw.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


load_env()
client = GeminiClient()


def chat(message, history):
    try:
        result = answer_question(message, client.generate)
        if result["status"] == "ANSWERED" and result.get("source") not in ("", "없음"):
            return f"{result['answer']}\n\n참고: {result['source']}"
        return result["answer"]
    except Exception:
        try:
            from rag import detect_certificate, normalize_question, retrieve, retrieve_common, CLARIFY_CERT
            normalized = normalize_question(message)
            certificate = detect_certificate(normalized)

            if certificate:
                results = retrieve(normalized)
            else:
                results = retrieve_common(normalized)

            if results:
                best_score, best_doc = results[0]
                reply = best_doc.get('reply', best_doc.get('text', ''))
                source = f"{best_doc.get('cert', 'FAQ')} · {best_doc.get('title', 'FAQ')}"
                return f"{reply}\n\n참고: {source}"
            else:
                return CLARIFY_CERT if not certificate else "죄송합니다. 현재 제공된 FAQ에서 확인하기 어려운 내용입니다."
        except:
            return "죄송합니다. 현재 답변을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."


CERTS = [
    "한식조리기능사", "지게차운전기능사", "굴착기운전기능사", "전기기능사",
    "공인중개사", "손해평가사", "요양보호사", "위생사", "공통",
]


def do_add(cert, category, title, reply):
    if not title.strip() or not reply.strip():
        return "제목과 답변을 입력하세요", get_faq_table()
    add_faq_entry(cert, category.strip(), title.strip(), reply.strip())
    rebuild_index()
    return f"추가 완료 (총 {get_faq_count()}건, TF-IDF 재구축됨)", get_faq_table()


def do_delete(faq_id_str):
    if not faq_id_str.strip():
        return "삭제할 FAQ ID를 입력하세요", get_faq_table()
    try:
        faq_id = int(faq_id_str.strip())
    except ValueError:
        return "ID는 숫자여야 합니다", get_faq_table()
    delete_faq_entry(faq_id)
    rebuild_index()
    return f"삭제 완료 (총 {get_faq_count()}건, TF-IDF 재구축됨)", get_faq_table()


def do_search(query):
    return get_faq_table(query)


def do_add_synonym(short, full):
    if not short.strip() or not full.strip():
        return "줄임말과 정식 명칭을 모두 입력해 주세요.", get_synonyms_table()
    add_synonym(short.strip(), full.strip())
    return f"추가 완료: {short.strip()} → {full.strip()}", get_synonyms_table()


def do_delete_synonym(short):
    if not short.strip():
        return "삭제할 줄임말을 입력해 주세요.", get_synonyms_table()
    delete_synonym(short.strip())
    return f"삭제 완료: {short.strip()}", get_synonyms_table()


with gr.Blocks(title="두두자격지원센터 FAQ 챗봇") as demo:

    with gr.Tab("챗봇"):
        gr.Markdown(
            f"## 두두자격지원센터 자격증 시험 FAQ\n"
            f"{get_faq_count():,}건의 FAQ를 바탕으로 안내합니다. "
            "정확한 답변을 위해 자격증명을 함께 입력해 주세요."
        )
        chatbot = gr.ChatInterface(fn=chat, examples=[
            "한식조리기능사 시험비가 얼마예요?",
            "지게차 접수는 어디서 해요?",
            "요양보호사 합격 기준이 몇 점이에요?",
            "요보사 합격 기준이 몇 점이에요?",
            "공인중개사 환불 규정이 어떻게 되나요?",
        ])

    with gr.Tab("FAQ 관리"):
        gr.Markdown(f"## FAQ 관리 ({get_faq_count():,}건)\nFAQ를 추가하거나 삭제하면 검색 결과에 바로 반영됩니다.")

        with gr.Row():
            cert_input = gr.Dropdown(choices=CERTS, label="자격증", value="한식조리기능사")
            cat_input = gr.Textbox(label="카테고리", placeholder="예: 접수비, 합격기준, 환불")
        title_input = gr.Textbox(label="제목", placeholder="예: 한식조리기능사 준비물")
        reply_input = gr.Textbox(label="답변 내용", lines=3)
        add_btn = gr.Button("FAQ 추가", variant="primary")
        add_msg = gr.Textbox(label="결과", interactive=False)

        gr.Markdown("---")

        with gr.Row():
            delete_id = gr.Textbox(label="삭제할 FAQ ID (숫자)", placeholder="예: 4706")
            delete_btn = gr.Button("삭제", variant="stop")
        delete_msg = gr.Textbox(label="결과", interactive=False)

        gr.Markdown("---")
        search_input = gr.Textbox(label="검색 (자격증명/카테고리/제목)", placeholder="예: 요양보호사")
        search_btn = gr.Button("검색")
        faq_table = gr.Dataframe(
            value=get_faq_table(),
            headers=["ID", "자격증", "카테고리", "제목"],
            label="FAQ 목록 (최근 50건)",
        )

        add_btn.click(do_add, [cert_input, cat_input, title_input, reply_input], [add_msg, faq_table])
        delete_btn.click(do_delete, [delete_id], [delete_msg, faq_table])
        search_btn.click(do_search, [search_input], [faq_table])

    with gr.Tab("동의어 관리"):
        gr.Markdown(
            "## 동의어 관리\n"
            "사용자가 자주 쓰는 줄임말이나 통칭을 등록하면 다음 질문부터 바로 검색에 반영됩니다."
        )

        with gr.Row():
            synonym_short = gr.Textbox(label="줄임말/통칭", placeholder="예: 전기사")
            synonym_full = gr.Textbox(label="정식 명칭", placeholder="예: 전기기능사")
        add_synonym_btn = gr.Button("동의어 추가", variant="primary")
        add_synonym_msg = gr.Textbox(label="결과", interactive=False)

        gr.Markdown("---")

        with gr.Row():
            delete_synonym_short = gr.Textbox(label="삭제할 줄임말", placeholder="예: 전기사")
            delete_synonym_btn = gr.Button("동의어 삭제", variant="stop")
        delete_synonym_msg = gr.Textbox(label="결과", interactive=False)

        gr.Markdown("---")
        synonym_table = gr.Dataframe(
            value=get_synonyms_table(),
            headers=["줄임말/통칭", "정식 명칭"],
            label="동의어 목록",
        )

        add_synonym_btn.click(
            do_add_synonym,
            [synonym_short, synonym_full],
            [add_synonym_msg, synonym_table],
        )
        delete_synonym_btn.click(
            do_delete_synonym,
            [delete_synonym_short],
            [delete_synonym_msg, synonym_table],
        )


if __name__ == "__main__":
    demo.launch(share=True)
