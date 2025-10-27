"""
TRIBOI AI - Production Backend
FastAPI + OpenAI Assistant API + Vector Store
Uses your uploaded documents (Triboi Corpus)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import os
import time
from typing import Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="TRIBOI AI API",
    version="2.0.0 (Assistant Mode)",
    docs_url="/docs",
)

# CORS - allow your domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://triboiai.online",
        "https://www.triboiai.online",
        "https://*.pages.dev",
        "http://localhost:*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
try:
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    logger.info("✅ OpenAI client initialized")
except Exception as e:
    logger.error(f"❌ OpenAI init error: {e}")
    client = None

# Your Assistant and Vector Store IDs
ASSISTANT_ID = os.environ.get("ASSISTANT_ID", "asst_KCDVmKibFiGlj64M2qcHwKkC")
VECTOR_STORE_ID = os.environ.get("VECTOR_STORE_ID", "vs_68ed9b8092348191866c77f4bb46b155")

# Request/Response models
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

# Additional instructions per mode (sent with each message)
MODE_INSTRUCTIONS = {
    "ro": {
        "vindecare": """Modul VINDECARE activat.

Folosește DOAR informațiile din documentele Corpusului Triboi pentru:
- Codurile Universale (Observare, Acceptare, Iertare, Reconectare)
- Tehnici practice din cărți (respirație 4-6, grounding 5-4-3-2-1)
- Exemple și pași din metodologia Triboi

IMPORTANT:
- Citează din documente când e relevant
- Structurează în PAȘI numerotați (PASUL 1, PASUL 2, etc.)
- Menționează CODURILE TRIBOI folosite
- Oferă EXEMPLU FINAL concret

NU inventa informații care nu sunt în Corpusul Triboi!""",

        "educatie": """Modul EDUCAȚIE activat.

Folosește DOAR informațiile din documentele Corpusului Triboi pentru:
- 41+17 Coduri CET (Coduri Educaționale Triboi)
- Educația ca antidot al crizelor
- Metode practice pentru profesori/părinți/elevi

NU inventa coduri sau metode care nu sunt în documente!""",

        "performanta": """Modul PERFORMANȚĂ activat.

Folosește DOAR informațiile din documentele Corpusului Triboi pentru:
- Leadership conștient
- Simbioza Umanistă
- Tehnici pentru sportivi și echipe

NU inventa principii care nu sunt în Corpusul Triboi!"""
    },
    "en": {
        "vindecare": """HEALING mode activated.

Use ONLY information from Triboi Corpus documents for:
- Universal Codes (Observation, Acceptance, Forgiveness, Reconnection)
- Practical techniques from books (4-6 breathing, 5-4-3-2-1 grounding)
- Examples and steps from Triboi methodology

DO NOT invent information not in Triboi Corpus!""",

        "educatie": """EDUCATION mode activated.

Use ONLY information from Triboi Corpus for CET Codes and educational methods.

DO NOT invent codes not in documents!""",

        "performanta": """PERFORMANCE mode activated.

Use ONLY information from Triboi Corpus for conscious leadership and symbiosis.

DO NOT invent principles not in Triboi Corpus!"""
    }
}

@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "status": "🟢 ONLINE",
        "service": "TRIBOI AI API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/api/health",
            "chat": "/api/chat (POST)",
            "docs": "/docs"
        }
    }

@app.get("/api/health")
async def health_check():
    """Detailed health check"""
    api_key_set = bool(os.environ.get("OPENAI_API_KEY"))
    
    return {
        "status": "healthy" if (client and api_key_set) else "degraded",
        "openai_configured": api_key_set,
        "openai_client": "initialized" if client else "failed",
        "service": "TRIBOI AI Backend",
        "version": "1.0.0"
    }

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Main chat endpoint using OpenAI Assistant with Vector Store
    
    This endpoint:
    1. Creates a thread
    2. Adds user message with mode-specific instructions
    3. Runs assistant (which searches your documents automatically)
    4. Returns response based on Triboi Corpus
    """
    
    # Validate OpenAI client
    if not client:
        logger.error("OpenAI client not initialized")
        raise HTTPException(
            status_code=503, 
            detail="OpenAI service unavailable. Check API key configuration."
        )
    
    # Validate input
    query = request.query.strip()
    if not query or len(query) < 2:
        raise HTTPException(
            status_code=400,
            detail="Query too short (minimum 2 characters)"
        )
    
    if len(query) > 2000:
        raise HTTPException(
            status_code=400,
            detail="Query too long (maximum 2000 characters)"
        )
    
    # Validate mode
    valid_modes = ["vindecare", "educatie", "performanta"]
    mode = request.mode if request.mode in valid_modes else "vindecare"
    
    # Validate language
    lang = request.lang if request.lang in ["ro", "en"] else "ro"
    
    # Get mode-specific instructions
    mode_instruction = MODE_INSTRUCTIONS[lang].get(mode, MODE_INSTRUCTIONS[lang]["vindecare"])
    
    # Combine user query with mode instruction
    full_message = f"{mode_instruction}\n\n---\n\nÎntrebarea utilizatorului: {query}"
    
    try:
        logger.info(f"Processing Assistant request: mode={mode}, lang={lang}, query_length={len(query)}")
        
        # Step 1: Create a thread
        thread = client.beta.threads.create()
        logger.info(f"Thread created: {thread.id}")
        
        # Step 2: Add message to thread
        message = client.beta.threads.messages.create(
            thread_id=thread.id,
            role="user",
            content=full_message
        )
        logger.info(f"Message added: {message.id}")
        
        # Step 3: Run the assistant
        run = client.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=ASSISTANT_ID
        )
        logger.info(f"Run started: {run.id}")
        
        # Step 4: Wait for completion (with timeout)
        max_wait_time = 60  # seconds
        wait_interval = 1  # second
        elapsed_time = 0
        
        while run.status in ["queued", "in_progress"] and elapsed_time < max_wait_time:
            time.sleep(wait_interval)
            elapsed_time += wait_interval
            run = client.beta.threads.runs.retrieve(
                thread_id=thread.id,
                run_id=run.id
            )
            logger.info(f"Run status: {run.status} ({elapsed_time}s elapsed)")
        
        # Check if run completed successfully
        if run.status != "completed":
            logger.error(f"Run failed with status: {run.status}")
            raise HTTPException(
                status_code=500,
                detail=f"Assistant run failed: {run.status}"
            )
        
        # Step 5: Retrieve messages
        messages = client.beta.threads.messages.list(
            thread_id=thread.id,
            order="desc",
            limit=1
        )
        
        if not messages.data:
            raise HTTPException(
                status_code=500,
                detail="No response from assistant"
            )
        
        # Extract assistant's reply
        assistant_message = messages.data[0]
        
        # Get text content from the message
        ai_reply = ""
        sources_used = False
        
        for content in assistant_message.content:
            if content.type == "text":
                ai_reply += content.text.value
                # Check if file search was used (annotations present)
                if hasattr(content.text, 'annotations') and content.text.annotations:
                    sources_used = True
        
        if not ai_reply:
            raise HTTPException(
                status_code=500,
                detail="Empty response from assistant"
            )
        
        logger.info(f"✅ Response generated: {len(ai_reply)} characters, sources_used={sources_used}")
        
        return ChatResponse(
            success=True,
            reply=ai_reply,
            mode=mode,
            lang=lang,
            model="assistant",
            sources_used=sources_used
        )
        
    except Exception as e:
        logger.error(f"❌ Chat error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing request: {str(e)}"
        )

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return {
        "error": "Endpoint not found",
        "available_endpoints": ["/", "/api/health", "/api/chat", "/docs"]
    }

# For local development
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
