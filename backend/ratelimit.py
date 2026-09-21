"""Small in-memory sliding-window rate limiter (per client IP, per route group).

The public demo spends a shared Groq key, so unauthenticated callers must not be
able to burn it. State is per-process, which is fine for a single Render instance.
"""
import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

WINDOW_SECONDS = 60


def client_ip(request: Request) -> str:
    # Render/Vercel sit behind a proxy; the first X-Forwarded-For hop is the caller.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, upload_per_min: int, ask_per_min: int):
        super().__init__(app)
        self.limits = {"/api/upload-pdf": upload_per_min, "/api/query": ask_per_min, "/api/summary": ask_per_min}
        self.hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        limit = self.limits.get(request.url.path)
        if limit is None or request.method != "POST":
            return await call_next(request)

        now = time.monotonic()
        # /query and /summary share a bucket so they can't double the budget.
        group = "upload" if request.url.path == "/api/upload-pdf" else "ask"
        window = self.hits[(client_ip(request), group)]
        while window and now - window[0] > WINDOW_SECONDS:
            window.popleft()
        if len(window) >= limit:
            retry = int(WINDOW_SECONDS - (now - window[0])) + 1
            return JSONResponse(
                {"detail": f"Too many requests. Try again in {retry}s."},
                status_code=429,
                headers={"Retry-After": str(retry)},
            )
        window.append(now)
        if len(self.hits) > 10_000:
            for key in [k for k, v in self.hits.items() if not v or now - v[-1] > WINDOW_SECONDS]:
                del self.hits[key]
        return await call_next(request)
