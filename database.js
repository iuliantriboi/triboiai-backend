// ============================================
// SIMPLE IN-MEMORY "DATABASE" FOR LICENSES
// ESM default export with required methods
// ============================================

const licenses = new Map();

// (opțional) seed de test pentru a valida rapid fluxul
function seed() {
  const now = new Date();
  const in30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Coduri valide după regex: ^[BPM][1-9IUL0JVM]{11}$ (12 caractere total)
  const lic1 = {
    code: 'B1IUL0JVM1I9', // BASIC
    type: 'BASIC',
    questions_total: 50,
    questions_used: 0,
    status: 'ACTIVE',
    created_at: now.toISOString(),
    activated_at: null,
    last_used_at: null,
    expires_at: in30d.toISOString(),
  };

  const lic2 = {
    code: 'P9JVM1IUL0V1', // PREMIUM
    type: 'PREMIUM',
    questions_total: 500,
    questions_used: 0,
    status: 'ACTIVE',
    created_at: now.toISOString(),
    activated_at: null,
    last_used_at: null,
    expires_at: in30d.toISOString(),
  };

  licenses.set(lic1.code, lic1);
  licenses.set(lic2.code, lic2);
}

async function initializeDatabase() {
  if (licenses.size === 0) seed();
  return true;
}

async function getLicense(code) {
  return licenses.get(code) || null;
}

async function checkLicenseStatus(code) {
  const lic = licenses.get(code);
  if (!lic) return { valid: false, reason: 'License not found' };

  if (lic.status !== 'ACTIVE') {
    return { valid: false, reason: `License status: ${lic.status}` };
  }

  const now = Date.now();
  if (lic.expires_at && new Date(lic.expires_at).getTime() < now) {
    return { valid: false, reason: 'License expired' };
  }

  const remaining = lic.questions_total - lic.questions_used;
  if (remaining <= 0) {
    return { valid: false, reason: 'No questions remaining', questionsRemaining: 0 };
  }

  return { valid: true, reason: null, questionsRemaining: remaining };
}

async function activateLicense(code) {
  const lic = licenses.get(code);
  if (!lic) return null;
  lic.activated_at = new Date().toISOString();
  licenses.set(code, lic);
  return lic;
}

async function incrementQuestionUsage(code, _question = '', _fingerprint = 'unknown') {
  const lic = licenses.get(code);
  if (!lic) throw new Error('License not found');
  lic.questions_used = (lic.questions_used || 0) + 1;
  lic.last_used_at = new Date().toISOString();
  licenses.set(code, lic);
  return lic;
}

async function getAllLicenses() {
  return Array.from(licenses.values());
}

async function createLicense(code, type, questionsTotal) {
  const now = new Date();
  const in30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const newLic = {
    code,
    type,
    questions_total: Number(questionsTotal),
    questions_used: 0,
    status: 'ACTIVE',
    created_at: now.toISOString(),
    activated_at: null,
    last_used_at: null,
    expires_at: in30d.toISOString(),
  };

  licenses.set(code, newLic);
  return newLic;
}

export default {
  initializeDatabase,
  getLicense,
  checkLicenseStatus,
  activateLicense,
  incrementQuestionUsage,
  getAllLicenses,
  createLicense,
};
