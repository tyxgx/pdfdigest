from __future__ import annotations

from functools import lru_cache
from typing import List

from groq import AsyncGroq

from config import get_settings

ALLOWED_MODELS = {"openai/gpt-oss-20b", "openai/gpt-oss-120b"}

SYSTEM_PROMPT = (
    "You answer questions using ONLY the PDF excerpts provided by the user. "
    "If the excerpts do not contain the answer, say so plainly instead of guessing."
)


class LLMError(RuntimeError):
    """Raised when the LLM provider call fails."""


@lru_cache
def get_client() -> AsyncGroq:
    api_key = get_settings().groq_api_key
    if not api_key:
        raise LLMError("GROQ_API_KEY is not set on the server")
    return AsyncGroq(api_key=api_key)


async def generate_answer(
    context_chunks: List[str],
    question: str,
    model_name: str | None = None,
    history: List[dict] | None = None,
) -> str:
    if not context_chunks:
        return "I couldn't find anything related to that question in the PDF."

    model = model_name or get_settings().groq_model
    context = "\n\n---\n\n".join(context_chunks)

    messages: List[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in (history or [])[-6:]:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append(
        {
            "role": "user",
            "content": f"PDF excerpts:\n{context}\n\nQuestion: {question}\n\nAnswer clearly and concisely.",
        }
    )

    try:
        completion = await get_client().chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.1,
            # gpt-oss models spend part of the budget on reasoning tokens.
            max_tokens=1500,
        )
    except LLMError:
        raise
    except Exception as exc:
        raise LLMError(f"{type(exc).__name__}: {exc}") from exc

    answer = (completion.choices[0].message.content or "").strip()
    return answer or "I couldn't generate an answer."
