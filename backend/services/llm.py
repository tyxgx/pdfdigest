from __future__ import annotations

from groq import Groq
from typing import List

from config import get_settings

settings = get_settings()

client = Groq(api_key=settings.groq_api_key)


async def generate_answer(context_chunks: list[str], question: str, model_name: str | None = None) -> str:
    if not context_chunks:
        return "I couldn't find anything related to that question in the PDF."

    context = "\n\n".join(context_chunks)

    model = model_name or settings.groq_model  # per-request override allowed

    prompt = f"""
You are an AI assistant. Your job is to answer questions using ONLY the text below.

PDF Content:
{context}

Question: {question}

Answer clearly and concisely.
"""

    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You answer questions based ONLY on the provided PDF text.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.1,
            max_tokens=300,
        )

        answer = completion.choices[0].message.content.strip()
        return answer or "I couldn't generate an answer."
    except Exception as e:
        return f"LLM error: {e}"