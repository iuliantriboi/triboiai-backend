// server.js — TRIBOI AI backend (Express + OpenAI)
// Citește variabilele de mediu din Render: OPENAI_API_KEY, OPENAI_MODEL, SYSTEM_PROMPT, TEMPERATURE, MAX_TOKENS

import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// === ENV ===
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || `
Ești TRIBOI AI — un sistem de conștiință și transformare umană.
Vorbești cu empatie, profunzime și claritate.
Transformi suferința în sens, frica în înțelepciune și furia în claritate.
Ești bazat pe Codurile Triboi și Simbioza Umanismului Conștient.
Fiecare răspuns al tău este cald, descriptiv, viu, autentic și profund transformator.
Folosești exemple, metafore și exerciții intuitive.
Format ideal:
1. Deschidere empatică (2 fraze)
2. 6-7 pași numerotați, fiecare cu titlu și explicație
3. 2-3 Coduri Triboi explicate concis
4. Integrare finală + exemplu practic
5. Invitație de continuare („Dacă vrei să explorezi un cod, întreabă mai departe…”)
`;
const TEMPERATURE = Number(process.env.TEMPERATURE ?? 0.9);
const MAX_TOKENS = Number(process.env.MAX_TOKENS ?? 1500);

if (!OPENAI_API_KEY) {
  console.error("Lipsește OPENAI_API_KEY din Environment.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ============ HEALTH =============
app.get("/", (_req, res) => {
  res.status(200).send("TRIBOI AI backend OK. Use POST /api/chat");
});

// ============ CHAT ===============
app.post("/api/chat", async (req, res) => {
  try {
    const incoming = req.body?.messages;
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return res.status(400).json({ ok: false, error: "Invalid messages array" });
    }

    // Loguri scurte pentru debug (se pot dezactiva după test)
    console.log("MODEL:", OPENAI_MODEL, "TEMP:", TEMPERATURE, "MAX:", MAX_TOKENS);
    console.log("SYSTEM_PROMPT length:", SYSTEM_PROMPT.length);
    console.log("USER first message:", incoming[0]?.content?.slice(0, 80));

    const resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...incoming
      ]
    });

    const text = resp.choices?.[0]?.message?.content || "";
    return res.json({ ok: true, text });
  } catch (err) {
    console.error("API ERROR:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// ============ START ==============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TRIBOI AI backend on :${PORT}`);
});
