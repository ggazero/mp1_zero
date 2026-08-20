"""두두자격지원센터 사용자용 공개 FAQ 챗봇."""
from __future__ import annotations

import gradio as gr

from app import chat
from rag import get_faq_count


demo = gr.ChatInterface(
    fn=chat,
    title="두두자격지원센터 자격증 시험 FAQ",
    description=(
        f"{get_faq_count():,}건의 FAQ를 바탕으로 안내합니다. "
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


if __name__ == "__main__":
    demo.launch(share=True)
