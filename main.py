"""
TRIBOI AI - Production Backend
FastAPI + OpenAI Assistant API + Vector Store
Uses your uploaded documents (Triboi Corpus)
"""

import os
import time
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from openai import OpenAI

# ------------------ Logging ------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("triboiai")

# ------------------ FastAPI app ------------------
app = FastAPI(
    title="TRIBOI AI API",
    version="2.0.0 (Assistant Mode)",
    docs_url="/docs",
)

# ------------------ CORS ------------------
ALLOWED_ORIGINS = [
    "https://triboiai.online",
    "https://www.triboiai.online",
    "https://triboiai-online99.pages.dev",
    "http://localhost:3000",
    "http://localhost:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------ OpenAI client ------------------
client: Optional[OpenAI] = None
try:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY missing")
    client = OpenAI()
    logger.info("✅ OpenAI client initialized")
except Exception as e:
    logger.error(f"❌ OpenAI init error: {e}")
    client = None

ASSISTANT_ID = os.environ.get("ASSISTANT_ID")
VECTOR_STORE_ID = os.environ.get("VECTOR_STORE_ID")

# ------------------ Models ------------------
class ChatRequest(BaseModel):
    query: str
    mode: str = "vindecare"
    lang: str = "ro"

class ChatResponse(BaseModel):
    success: bool
    reply: str
    mode: str
    lang: str
    model: str = "assistant"
    sources_used: bool = False

# ------------------ Mode instructions ------------------
MODE_INSTRUCTIONS = {
    "ro": {
        "vindecare": (
            "Modul VINDECARE activat.\n\n"
            "Folosește DOAR informațiile din Corpusul Triboi:\n"
            "- Coduri (Observare, Acceptare, Iertare, Reconectare)\n"
            "- Tehnici practice (respirație 4-6, grounding 5-4-3-2-1)\n"
            "- Pași din metodologia Triboi\n\n"
            "IMPORTANT: Structurează în PAȘI numerotați, menționează Codurile Triboi, "
            "oferă exemplu final concret. NU inventa informații în afara corpusului."
        ),
        "educatie": (
            "Modul EDUCAȚIE activat. Folosește DOAR Corpusul Triboi "
            "(41+17 Coduri CET, metode pentru profesori/părinți/elevi). "
            "NU inventa coduri/methodologii care nu sunt în documente."
        ),
        "performanta": (
            "Modul PERFORMANȚĂ activat. Folosește DOAR Corpusul Triboi "
            "(leadership conștient, Simbioză, tehnici pentru sportivi/echipe). "
            "NU inventa principii în afara corpusului."
        ),
    },
    "en": {
        "vindecare": (
            "HEALING mode activated. Use ONLY Triboi Corpus (Universal Codes, practical "
            "techniques, step-by-step). Structure in numbered steps; do not invent content."
        ),
        "educatie": "EDUCATION mode activated. Use ONLY Triboi Corpus for CET Codes.",
        "performanta": "PERFORMANCE mode activated. Use ONLY Triboi Corpus.",
    },
}

# ------------------ Endpoints ------------------
@app.get("/")
async def root():
    return {
        "status": "🟢 ONLINE",
        "service": "TRIBOI AI API",
        "version": "1.0.0",
        "endpoints": {"health": "/api/health", "chat": "/api/chat (POST)", "docs": "/docs"},
    }

@app.get("/api/health")
async def health_check():
    api_key_set = bool(os.environ.get("OPENAI_API_KEY"))
    return {
        "status": "healthy" if (client and api_key_set) else "degraded",
        "openai_configured": api_key_set,
        "openai_client": "initialized" if client else "failed",
        "assistant_id_set": bool(ASSISTANT_ID),
        "vector_store_id_set": bool(VECTOR_STORE_ID),
        "service": "TRIBOI AI Backend",
        "version": "1.0.0",
    }

@app.post("/api/chat", response_model=ChatResponse)
async def api_chat(request: ChatRequest):
    if client is None:
        logger.error("OpenAI client not initialized")
        raise HTTPException(status_code=503, detail="OpenAI service unavailable. Check API key configuration.")
    if not ASSISTANT_ID:
        raise HTTPException(status_code=500, detail="ASSISTANT_ID is not configured on server.")

    query = request.query.strip()
    if len(query) < 2:
        raise HTTPException(status_code=400, detail="Query too short (minimum 2 characters)")
    if len(query) > 2000:
        raise HTTPException(status_code=400, detail="Query too long (maximum 2000 characters)")

    mode = request.mode if request.mode in ["vindecare", "educatie", "performanta"] else "vindecare"
    lang = request.lang if request.lang in ["ro", "en"] else "ro"
    mode_instruction = MODE_INSTRUCTIONS[lang].get(mode, MODE_INSTRUCTIONS[lang]["vindecare"])

    full_message = f"{mode_instruction}\n\n---\n\nÎntrebarea utilizatorului: {query}"

    try:
        logger.info(f"Assistant run start | mode={mode} lang={lang} len={len(query)}")
        # 1) Thread
        thread = client.beta.threads.create()
        # 2) Add user message
        client.beta.threads.messages.create(
            thread_id=thread.id,
            role="user",
            content=full_message,
        )
        # 3) Run assistant
        run = client.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=ASSISTANT_ID,
        )

        # 4) Poll for completion
        timeout_s = 90
        waited = 0
        while run.status in ("queued", "in_progress") and waited < timeout_s:
            time.sleep(1)
            waited += 1
            run = client.beta.threads.runs.retrieve(thread_id=thread.id, run_id=run.id)

        if run.status != "completed":
            logger.error(f"Assistant run ended with status={run.status}")
            raise HTTPException(status_code=500, detail=f"Assistant run failed: {run.status}")

        # 5) Get latest assistant message
        messages = client.beta.threads.messages.list(thread_id=thread.id, order="desc", limit=1)
        if not messages.data:
            raise HTTPException(status_code=500, detail="No response from assistant")

        assistant_msg = messages.data[0]
        reply_text = ""
        sources_used = False
        for c in assistant_msg.content:
            if c.type == "text":
                reply_text += c.text.value or ""
                if getattr(c.text, "annotations", None):
                    sources_used = True

        if not reply_text.strip():
            raise HTTPException(status_code=500, detail="Empty response from assistant")

        logger.info(f"Assistant reply len={len(reply_text)} sources_used={sources_used}")
        return ChatResponse(
            success=True,
            reply=reply_text,
            mode=mode,
            lang=lang,
            model="assistant",
            sources_used=sources_used,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing request: {e}")

# ------------------ Error handlers ------------------
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Endpoint not found", "available_endpoints": ["/", "/api/health", "/api/chat", "/docs"]},
    )

# ------------------ Local run ------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
