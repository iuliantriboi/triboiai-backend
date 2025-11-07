// ============================================
// TRIBOI AI - LICENSE MANAGEMENT SERVER
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database');

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

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Triboi AI License Management',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ============================================
// LICENSE VALIDATION
// ============================================

app.post('/api/license/validate', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'License code required' });
    }
    
    // Validate code format
    if (!/^[BPM][1-9IUL0JVM]{11}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid license code format' });
    }
    
    const license = await db.getLicense(code);
    
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    
    const status = await db.checkLicenseStatus(code);
    
    res.json({
      valid: status.valid,
      license: status.valid ? {
        code: license.code,
        type: license.type,
        questionsTotal: license.questions_total,
        questionsUsed: license.questions_used,
        questionsRemaining: status.questionsRemaining,
        activatedAt: license.activated_at,
        expiresAt: license.expires_at,
        status: license.status
      } : null,
      reason: status.reason || null
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
    
    if (!code) {
      return res.status(400).json({ error: 'License code required' });
    }
    
    const license = await db.getLicense(code);
    
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    
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
        expiresAt: activated.expires_at
      }
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
    
    if (!code) {
      return res.status(400).json({ error: 'License code required' });
    }
    
    // Check license status first
    const status = await db.checkLicenseStatus(code);
    
    if (!status.valid) {
      return res.status(403).json({ 
        error: status.reason,
        valid: false
      });
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
      questionsRemaining: updated.questions_total - updated.questions_used
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
    
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    
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
      lastUsedAt: license.last_used_at
    });
    
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// ADMIN: CREATE LICENSE
// ============================================

app.post('/api/admin/license/create', async (req, res) => {
  try {
    const { code, type, questionsTotal } = req.body;
    
    // Validate input
    if (!code || !type || !questionsTotal) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!['BASIC', 'PREMIUM'].includes(type)) {
      return res.status(400).json({ error: 'Invalid license type' });
    }
    
    // Check if license already exists
    const existing = await db.getLicense(code);
    if (existing) {
      return res.status(400).json({ error: 'License code already exists' });
    }
    
    const license = await db.createLicense(code, type, questionsTotal);
    
    res.json({
      success: true,
      license: {
        code: license.code,
        type: license.type,
        questionsTotal: license.questions_total,
        createdAt: license.created_at
      }
    });
    
  } catch (error) {
    console.error('License creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// ADMIN: GET ALL LICENSES
// ============================================

app.get('/api/admin/licenses', async (req, res) => {
  try {
    const licenses = await db.getAllLicenses();
    
    res.json({
      success: true,
      count: licenses.length,
      licenses: licenses.map(l => ({
        code: l.code,
        type: l.type,
        questionsTotal: l.questions_total,
        questionsUsed: l.questions_used,
        questionsRemaining: l.questions_total - l.questions_used,
        status: l.status,
        createdAt: l.created_at,
        activatedAt: l.activated_at,
        expiresAt: l.expires_at,
        lastUsedAt: l.last_used_at
      }))
    });
    
  } catch (error) {
    console.error('Get licenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
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
