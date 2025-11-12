// ============================================
// TRIBOI AI - LICENSE MANAGEMENT SERVER (ESM)
// ============================================

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import db from './database.js'; // <- exista în același folder

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database on startup
db.initializeDatabase().catch(console.error);

// ============================================
// HEALTH CHECK
// ============================================

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Triboi AI License Management',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ============================================
// LICENSE VALIDATION
// ============================================

app.post('/api/license/validate', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) return res.status(400).json({ error: 'License code required' });

    // Validate code format
    if (!/^[BPM][1-9IUL0JVM]{11}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid license code format' });
    }

    const license = await db.getLicense(code);
    if (!license) return res.status(404).json({ error: 'License not found' });

    const status = await db.checkLicenseStatus(code);

    res.json({
      valid: status.valid,
      license: status.valid
        ? {
            code: license.code,
            type: license.type,
            questionsTotal: license.questions_total,
            questionsUsed: license.questions_used,
            questionsRemaining: status.questionsRemaining,
            activatedAt: license.activated_at,
            expiresAt: license.expires_at,
            status: license.status,
          }
        : null,
      reason: status.reason || null,
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// LICENSE ACTIVATION
// ============================================

app.post('/api/license/activate', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) return res.status(400).json({ error: 'License code required' });

    const license = await db.getLicense(code);
    if (!license) return res.status(404).json({ error: 'License not found' });

    if (license.activated_at) {
      return res.status(400).json({ error: 'License already activated' });
    }

    const activated = await db.activateLicense(code);

    res.json({
      success: true,
      license: {
        code: activated.code,
        type: activated.type,
        questionsTotal: activated.questions_total,
        activatedAt: activated.activated_at,
        expiresAt: activated.expires_at,
      },
    });
  } catch (error) {
    console.error('Activation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// USE QUESTION (INCREMENT COUNTER)
// ============================================

app.post('/api/license/use', async (req, res) => {
  try {
    const { code, question, deviceFingerprint } = req.body;

    if (!code) return res.status(400).json({ error: 'License code required' });

    // Check license status first
    const status = await db.checkLicenseStatus(code);
    if (!status.valid) {
      return res.status(403).json({ error: status.reason, valid: false });
    }

    // Increment usage
    const updated = await db.incrementQuestionUsage(
      code,
      question || '',
      deviceFingerprint || 'unknown'
    );

    res.json({
      success: true,
      questionsUsed: updated.questions_used,
      questionsRemaining: updated.questions_total - updated.questions_used,
    });
  } catch (error) {
    console.error('Usage increment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// GET LICENSE STATUS
// ============================================

app.get('/api/license/status/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const license = await db.getLicense(code);
    if (!license) return res.status(404).json({ error: 'License not found' });

    const status = await db.checkLicenseStatus(code);

    res.json({
      valid: status.valid,
      code: license.code,
      type: license.type,
      questionsTotal: license.questions_total,
      questionsUsed: license.questions_used,
      questionsRemaining: status.questionsRemaining || 0,
      activatedAt: license.activated_at,
      expiresAt: license.expires_at,
      status: license.status,
      lastUsedAt: license.last_used_at,
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// CHAT: forward la OpenAI (Responses API)
// ============================================

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Mesajul utilizatorului lipsește' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Lipsește OPENAI_API_KEY în environment' });
    }

    // Construim payload conform Responses API (fără assistant_id)
    const payload = {
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: message,
    };

    // (opțional) System prompt + sampling din env, dacă le ai setate
    if (process.env.SYSTEM_PROMPT) payload.instructions = process.env.SYSTEM_PROMPT;
    if (process.env.TEMPERATURE) payload.temperature = Number(process.env.TEMPERATURE);
    if (process.env.TOP_P) payload.top_p = Number(process.env.TOP_P);
    if (process.env.PRESENCE_PENALTY) payload.presence_penalty = Number(process.env.PRESENCE_PENALTY);
    if (process.env.FREQUENCY_PENALTY) payload.frequency_penalty = Number(process.env.FREQUENCY_PENALTY);

    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const text = await r.text();
      console.error('OpenAI error:', text);
      return res.status(502).json({ error: 'Eroare OpenAI', detail: text });
    }

    const data = await r.json();

    // Extragem textul din Responses API
    const output =
      data?.output_text ||
      (Array.isArray(data?.output)
        ? data.output.map(p => p?.content?.[0]?.text?.value).filter(Boolean).join('\n')
        : null) ||
      'Nu am primit un răspuns text.';

    res.json({ ok: true, text: output });
  } catch (err) {
    console.error('Chat proxy error:', err);
    res.status(500).json({ error: 'Eroare internă chat' });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found' }));

app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║  TRIBOI AI LICENSE SERVER                 ║
║  Running on port ${PORT}                     ║
║  Environment: ${process.env.NODE_ENV || 'development'}            ║
╚═══════════════════════════════════════════╝
  `);
});
