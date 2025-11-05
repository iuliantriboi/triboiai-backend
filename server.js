import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { OpenAI } from 'openai';

// ====== CONFIG ======
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

if (!OPENAI_API_KEY) {
  console.error('ERROR: Missing OPENAI_API_KEY env variable.');
  process.exit(1);
}

const app = express();
app.use(bodyParser.json({ limit: '1mb' }));

// CORS allowlist for your frontends
const allowOrigins = [
  'https://triboiai.online',
  'https://www.triboiai.online',
  // Cloudflare Pages preview / prod subdomains (replace/add yours as needed)
  // e.g. 'https://tribioai-online99.pages.dev'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // server-to-server or curl
    try {
      const url = new URL(origin);
      const host = url.host;
      const allowed = allowOrigins.includes(origin) || host.endsWith('.pages.dev');
      if (allowed) return callback(null, true);
      return callback(new Error('Not allowed by CORS: ' + origin));
    } catch (e) {
      return callback(new Error('Invalid Origin'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // respond to preflight

// Health check
app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

// OpenAI client
const client = new OpenAI({ apiKey: OPENAI_API_KEY });

// Chat relay
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, system, temperature } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages must be an array [{role, content}]' });
    }

    // Build input for Responses API
    const input = [];
    input.push({ role: 'system', content: system || 'You are Triboi AI. Răspunzi concis, cald și coerent, folosind terminologia CET când e relevant.' });
    for (const m of messages) {
      if (m && m.role && m.content !== undefined) input.push({ role: m.role, content: m.content });
    }

    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input,
      temperature: typeof temperature === 'number' ? temperature : 0.7
      // You can enable streaming later if needed
    });

    const text = response.output_text ?? (response.choices?.[0]?.message?.content ?? '');
    res.json({ ok: true, text, response });
  } catch (err) {
    console.error('openai_error:', err?.response?.data || err.message || err);
    const status = err?.status ?? 500;
    res.status(status).json({ ok: false, error: 'openai_request_failed', detail: err?.response?.data || err.message });
  }
});

app.listen(PORT, () => {
  console.log('TriboiAI backend listening on port', PORT);
});
