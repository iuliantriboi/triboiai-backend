// ============================================
// TRIBOI AI - LICENSE SYSTEM V3 (INTEGRATED)
// ============================================

(function () {
  'use strict';

  // =====================================================
  // CONFIG
  // =====================================================

  const LICENSE_CONFIG = {
    BASIC: {
      prefix: 'B',
      chars: ['1', '9', '7', '4', 'I', 'U', 'L'],
      maxQuestions: 10,
      maxDays: 30,
      price: 20, // EUR
      name: 'Basic',
    },
    PREMIUM: {
      prefix: 'P',
      chars: ['2', '0', '8', '5', 'J', 'V', 'M'],
      maxQuestions: 100,
      maxDays: 365,
      price: 100, // EUR
      name: 'Premium',
    },
  };

  const STORAGE_KEY = 'triboiai_license';

  // Dacă tocmai am consumat ultima întrebare, blocăm la următoarea (a 11-a)
  let licenseJustExpired = false;

  // =====================================================
  // DEVICE FINGERPRINT (rezervat pentru integrare cu backend)
  // =====================================================

  function getDeviceFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
    const canvasFingerprint = canvas.toDataURL();

    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvas: canvasFingerprint.substring(0, 50),
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
    };

    const s = JSON.stringify(fingerprint);
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = (hash << 5) - hash + s.charCodeAt(i);
      hash |= 0;
    }
    return 'device_' + Math.abs(hash).toString(36);
  }

  // =====================================================
  // VALIDATION
  // =====================================================

  function validateCodePattern(code) {
    const clean = code.trim().toUpperCase().replace(/\s/g, '');
    if (clean.length !== 8) return null;

    const prefix = clean[0];
    const body = clean.slice(1);

    let cfg = null;
    if (prefix === 'B') cfg = LICENSE_CONFIG.BASIC;
    else if (prefix === 'P') cfg = LICENSE_CONFIG.PREMIUM;
    else return null;

    const chars = body.split('');
    if (chars.length !== 7) return null;

    const ok =
      [...chars].sort().join('') === [...cfg.chars].sort().join('');
    if (!ok) return null;

    return {
      type: prefix === 'B' ? 'BASIC' : 'PREMIUM',
      code: clean,
      ...cfg,
    };
  }

  // =====================================================
  // STORAGE
  // =====================================================

  function getLicense() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (_) {
      return null;
    }
  }

  function saveLicense(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function clearLicense() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // =====================================================
  // LICENSE STATUS
  // =====================================================

  function checkStatus() {
    const license = getLicense();
    if (!license) return { valid: false, reason: 'no_license' };

    // întrebări rămase
    if (license.questionsUsed >= license.maxQuestions) {
      return { valid: false, reason: 'questions_exceeded', license };
    }

    // zile rămase
    const now = Date.now();
    const elapsedDays = Math.floor((now - license.activationDate) / 86400000);
    const daysRemaining = Math.max(0, license.maxDays - elapsedDays);

    if (daysRemaining <= 0) {
      return { valid: false, reason: 'expired', license };
    }

    return {
      valid: true,
      license,
      questionsRemaining: license.maxQuestions - license.questionsUsed,
      daysRemaining,
    };
  }

  function activateLicense(code) {
    const pack = validateCodePattern(code);
    if (!pack) return { success: false, error: 'Cod invalid' };

    const license = {
      code: pack.code,
      type: pack.type,
      maxQuestions: pack.maxQuestions,
      maxDays: pack.maxDays,
      activationDate: Date.now(),
      questionsUsed: 0,
      // deviceId: getDeviceFingerprint(), // pregătit pentru lock pe device
    };
    saveLicense(license);
    licenseJustExpired = false;

    return {
      success: true,
      data: license,
      message: `Licență ${pack.name} activată!`,
    };
  }

  function incrementQuestions() {
    const lic = getLicense();
    if (!lic) return;
    lic.questionsUsed += 1;
    saveLicense(lic);
  }

  // =====================================================
  // UI — LICENSE MODAL
  // =====================================================

  function createModal() {
    const modal = document.createElement('div');
    modal.id = 'triboi-license-modal';
    modal.innerHTML = `
      <style>
        #triboi-license-modal{position:fixed;inset:0;background:rgba(0,0,0,.95);backdrop-filter:blur(10px);z-index:10000;display:flex;align-items:center;justify-content:center}
        #triboi-license-modal .modal-content{background:linear-gradient(135deg,#0d1117 0%,#1a1f2e 100%);border:2px solid #2dd4bf;border-radius:20px;padding:40px;max-width:480px;width:90%;box-shadow:0 20px 60px rgba(45,212,191,.4)}
        #triboi-license-modal h2{color:#2dd4bf;margin:0 0 10px;font-size:26px;display:flex;align-items:center;gap:12px}
        #triboi-license-modal h2 img{height:48px}
        #triboi-license-modal .subtitle{color:#94a3b8;margin:0 0 25px;font-size:14px}
        #triboi-license-modal input{width:100%;padding:16px;border:2px solid #334155;background:#0b1220;color:#e5e7eb;border-radius:12px;font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:2px;text-align:center;font-family:'Courier New',monospace}
        #triboi-license-modal input:focus{outline:none;border-color:#2dd4bf;box-shadow:0 0 0 3px rgba(45,212,191,.1)}
        #triboi-license-modal button{width:100%;padding:16px;border:none;background:linear-gradient(135deg,#2dd4bf 0%,#14b8a6 100%);color:#0b1220;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin-top:16px;transition:.2s}
        #triboi-license-modal .message{margin-top:16px;padding:12px;border-radius:8px;font-size:14px;text-align:center}
        #triboi-license-modal .message.error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#ef4444}
        #triboi-license-modal .message.success{background:rgba(45,212,191,.1);border:1px solid rgba(45,212,191,.3);color:#2dd4bf}
        #triboi-license-modal .info{background:rgba(100,116,139,.1);border:1px solid #334155;border-radius:12px;padding:16px;margin-top:24px;font-size:13px}
        #triboi-license-modal .info-title{color:#2dd4bf;font-weight:700;margin-bottom:10px}
        #triboi-license-modal .info-item{color:#cbd5e1;margin:6px 0}
        #triboi-license-modal .info-item strong{color:#e5e7eb}
      </style>
      <div class="modal-content">
        <h2><img src="assets/triboi-logo.png" alt="Triboi AI" /> Acces Triboi AI</h2>
        <div class="subtitle">Introdu codul tău de licență</div>
        <input id="license-input" placeholder="B/PXXXXXXX" autocomplete="off" maxlength="8"/>
        <button id="activate-btn">Activează</button>
        <div id="license-message"></div>
        <div class="info">
          <div class="info-title">📦 Pachete disponibile</div>
          <div class="info-item"><strong>BASIC:</strong> 10 întrebări • 30 zile • €20 • <span style="color:#2dd4bf">multiple devices</span></div>
          <div class="info-item"><strong>PREMIUM:</strong> 100 întrebări • 365 zile • €100 • <span style="color:#2dd4bf">multiple devices</span></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector('#license-input');
    const btn = modal.querySelector('#activate-btn');
    const msg = modal.querySelector('#license-message');

    function showMessage(t, type) {
      msg.className = `message ${type}`;
      msg.textContent = t;
    }

    btn.onclick = () => {
      const code = (input.value || '').trim();
      if (!code) return showMessage('Introdu un cod', 'error');

      const result = activateLicense(code);
      if (result.success) {
        showMessage(result.message, 'success');
        setTimeout(() => {
          modal.remove();
          unlockWidget();
          updateStatusBar();
        }, 1200);
      } else {
        showMessage(result.error, 'error');
        input.value = '';
        input.focus();
      }
    };

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') btn.click();
    });

    setTimeout(() => input.focus(), 50);
  }

  // =====================================================
  // UI — EXPIRED MODAL
  // =====================================================

  function showExpiredModal(status) {
    const modal = document.createElement('div');
    modal.id = 'triboi-expired-modal';
    modal.innerHTML = `
      <style>
        #triboi-expired-modal{position:fixed;inset:0;background:rgba(0,0,0,.95);backdrop-filter:blur(10px);z-index:10000;display:flex;align-items:center;justify-content:center}
        #triboi-expired-modal .modal-content{background:linear-gradient(135deg,#1a1f2e 0%,#0d1117 100%);border:2px solid #ef4444;border-radius:20px;padding:40px;max-width:480px;width:90%;text-align:center}
        #triboi-expired-modal h2{color:#ef4444;margin:0 0 16px;font-size:28px}
        #triboi-expired-modal p{color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:24px}
        #triboi-expired-modal button{padding:14px 28px;border:none;background:linear-gradient(135deg,#2dd4bf 0%,#14b8a6 100%);color:#0b1220;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin:8px;transition:.2s}
        #triboi-expired-modal .close-btn{background:transparent;border:2px solid #334155;color:#cbd5e1}
        #triboi-expired-modal .close-btn:hover{background:#334155}
      </style>
      <div class="modal-content">
        <h2>⏰ Licență Expirată</h2>
        <p>${status.reason === 'questions_exceeded'
          ? 'Ai folosit toate întrebările disponibile.'
          : 'Licența ta a expirat.'}</p>

        <div style="margin:24px 0;padding:20px;background:rgba(45,212,191,.05);border:1px solid rgba(45,212,191,.2);border-radius:12px;">
          <div style="color:#2dd4bf;font-weight:600;margin-bottom:12px;font-size:14px;">🔑 Ai un cod nou?</div>
          <input id="renew-license-input" placeholder="B/PXXXXXXX" autocomplete="off" maxlength="8"
                 style="width:100%;padding:12px;border:2px solid #334155;background:#0b1220;color:#e5e7eb;border-radius:8px;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:2px;text-align:center;font-family:'Courier New',monospace;margin-bottom:12px;" />
          <button id="renew-activate-btn" style="width:100%;padding:12px;border:none;background:linear-gradient(135deg,#2dd4bf 0%,#14b8a6 100%);color:#0b1220;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">
            Activează cod nou
          </button>
          <div id="renew-message" style="margin-top:12px;padding:8px;border-radius:6px;font-size:13px;text-align:center;display:none;"></div>
        </div>

        <button class="close-btn" id="close-expired-btn">Închide</button>
      </div>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector('#renew-license-input');
    const btn = modal.querySelector('#renew-activate-btn');
    const msg = modal.querySelector('#renew-message');
    const closeBtn = modal.querySelector('#close-expired-btn');

    function showMsg(t, type) {
      msg.style.display = 'block';
      msg.textContent = t;
      if (type === 'error') {
        msg.style.background = 'rgba(239,68,68,.1)';
        msg.style.border = '1px solid rgba(239,68,68,.3)';
        msg.style.color = '#ef4444';
      } else {
        msg.style.background = 'rgba(45,212,191,.1)';
        msg.style.border = '1px solid rgba(45,212,191,.3)';
        msg.style.color = '#2dd4bf';
      }
    }

    btn.onclick = () => {
      const code = (input.value || '').trim();
      if (!code) return showMsg('Introdu un cod', 'error');
      const result = activateLicense(code);
      if (result.success) {
        showMsg(result.message, 'success');
        setTimeout(() => {
          modal.remove();
          unlockWidget();
          updateStatusBar();
          location.reload();
        }, 1200);
      } else {
        showMsg(result.error, 'error');
        input.value = '';
        input.focus();
      }
    };

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') btn.click();
    });

    closeBtn.onclick = () => modal.remove();
    setTimeout(() => input.focus(), 50);
  }

  // =====================================================
  // STATUS BAR
  // =====================================================

  function updateStatusBar() {
    const wrap = document.getElementById('triboiai-license-status');
    const text = document.getElementById('triboiai-license-text');
    if (!wrap || !text) return;

    const status = checkStatus();
    if (!status.valid) {
      wrap.style.display = 'none';
      return;
    }

    const { license, questionsRemaining, daysRemaining } = status;
    const typeLabel = license.type === 'BASIC' ? 'BASIC' : 'PREMIUM';

    const lang = typeof window.currentLang !== 'undefined' ? window.currentLang : 'ro';
    const tr = (window.translations && window.translations[lang]) || {
      questions: 'întrebări',
      days: 'zile',
    };

    wrap.style.display = 'block';
    text.textContent = `${typeLabel} • ${questionsRemaining} ${tr.questions} • ${daysRemaining} ${tr.days}`;
  }

  // =====================================================
  // WIDGET CONTROL
  // =====================================================

  function lockWidget() {
    const w = document.getElementById('triboiai-widget');
    const input = document.getElementById('triboiai-input');
    const btn = document.getElementById('triboiai-send');
    if (w) { w.style.opacity = '0.5'; w.style.pointerEvents = 'none'; w.style.filter = 'blur(4px)'; }
    if (input) input.disabled = true;
    if (btn) btn.disabled = true;
  }

  function unlockWidget() {
    const w = document.getElementById('triboiai-widget');
    const input = document.getElementById('triboiai-input');
    const btn = document.getElementById('triboiai-send');
    if (w) { w.style.opacity = '1'; w.style.pointerEvents = 'auto'; w.style.filter = 'none'; }
    if (input) input.disabled = false;
    if (btn) btn.disabled = false;
  }

  // =====================================================
  // INTERCEPTARE — NU blocăm la întrebarea 10; blocăm la 11
  // =====================================================

  function interceptSendButton() {
    const btn = document.getElementById('triboiai-send');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      const s = checkStatus();

      // hard invalid (fără licență)
      const hardInvalid = !s.valid && s.reason === 'no_license';
      if (hardInvalid) {
        e.stopImmediatePropagation();
        lockWidget();
        showExpiredModal(s);
        return false;
      }

      // dacă am marcat că s-a terminat la întrebarea anterioară,
      // acum blocăm (încercarea întrebării 11)
      if (licenseJustExpired && !s.valid) {
        e.stopImmediatePropagation();
        lockWidget();
        showExpiredModal(s);
        licenseJustExpired = false;
        return false;
      }

      // Lăsăm întrebarea să plece; după ce pleacă, incrementăm
      setTimeout(() => {
        incrementQuestions();
        updateStatusBar();
        const s2 = checkStatus();

        // dacă acum a devenit invalid (am atins limita sau au expirat zilele),
        // NU afişăm modalul acum (utilizatorul trebuie să vadă răspunsul);
        // doar marcăm ca să blocăm la următoarea încercare
        if (!s2.valid && (s2.reason === 'questions_exceeded' || s2.reason === 'expired')) {
          licenseJustExpired = true;
        }
      }, 100);
    }, true);
  }

  // =====================================================
  // INIT
  // =====================================================

  function init() {
    const s = checkStatus();
    if (!s.valid) {
      lockWidget();
      if (s.reason === 'no_license') createModal();
      else showExpiredModal(s);
    } else {
      unlockWidget();
      updateStatusBar();
    }
    interceptSendButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // =====================================================
  // ADMIN (doar în browser)
  // =====================================================

  if (typeof window !== 'undefined') {
    window.triboiAdmin = {
      checkStatus,
      clearLicense: () => { clearLicense(); location.reload(); },
      testCode: (code) => { const r = validateCodePattern(code); console.log('Validation:', r); return r; },
      addQuestions: (n) => {
        const lic = getLicense();
        if (lic) {
          lic.questionsUsed = Math.max(0, lic.questionsUsed - n);
          saveLicense(lic);
          updateStatusBar();
          console.log(`Added ${n} questions`);
        }
      },
    };

    window.TriboiLicense = { updateStatusBar };
  }
})();
