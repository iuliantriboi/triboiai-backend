# TriboiAI Backend (Pasul 2)

Backend minimalist pentru `/api/chat` care relay-uiește cererile către OpenAI (Responses API).

## 1) Ce conține
- `GET /healthz` – test rapid (200 OK)
- `POST /api/chat` – primește `{ messages: [{role, content}], system?, temperature? }` și răspunde cu `{ ok, text }`
- CORS permis pentru:
  - `https://triboiai.online`
  - subdomenii `*.pages.dev` (Cloudflare Pages)

## 2) Instalare locală
```bash
npm ci
echo "OPENAI_API_KEY=sk-..." > .env
npm start
# Test
curl -s http://localhost:3000/healthz
```

## 3) Deploy pe Render (Web Service)
1. **Create New > Web Service** → conectează repo-ul sau uplodează acest folder.
2. **Environment**: Node
3. **Build Command**: `npm ci`
4. **Start Command**: `npm start`
5. **Environment Variables**:
   - `OPENAI_API_KEY` = cheie ta (Project API key)
   - (opțional) `OPENAI_MODEL` = `gpt-4.1-mini` (default)
6. Deploy.

### Test după deploy
Presupunem că Render îți dă domeniul: `https://triboiai-backend.onrender.com`
```bash
curl -s https://triboiai-backend.onrender.com/healthz
curl -s -X POST https://triboiai-backend.onrender.com/api/chat   -H 'Content-Type: application/json'   -d '{"messages":[{"role":"user","content":"Spune o frază-ancoră pentru Codul Clarității."}]}' | jq -r .text
```

## 4) Conectarea din front-end
Setează constanta `API` din `index.html` la:
```js
const API = 'https://TRASEUL_TAU_RENDER/api/chat';
```
sau folosește fallback-ul din patch-ul oferit (înlocuiește `YOUR-BACKEND-URL`).

## 5) Securitate
- Cheia OpenAI stă DOAR în variabila de mediu pe Render.
- Front-endul nu conține chei.
- CORS permite doar domeniile tale.
