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

  // Flag: dacă tocmai am consumat ultima întrebare,
  // blocăm abia LA URMĂTOAREA întrebare (a 11-a).
  let licenseJustExpired = false;

  // =====================================================
  // DEVICE FINGERPRINT (rezervat pentru backend)
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

    const fingerprintString = JSON.stringify(fingerprint);
    let hash = 0;
    for (let i = 0; i < fingerprintString.length; i++) {
      const char = fingerprintString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    return 'device_' + Math.abs(hash).toString(36);
  }

  // =====================================================
  // VALIDATION
  // =====================================================

  function validateCodePattern(code) {
    const cleanCode = code.trim().toUpperCase().replace(/\s/g, '');
    if (cleanCode.length !== 8) return null;

    const prefix = cleanCode[0];
    const codeBody = cleanCode.substring(1);

    let config = null;
    if (prefix === 'B') config = LICENSE_CONFIG.BASIC;
    else if (prefix === 'P') config = LICENSE_CONFIG.PREMIUM;
    else return null;

    const codeChars = codeBody.split('');
    if (codeChars.length !== 7) return null;

    const sortedCodeChars = [...codeChars].sort().join('');
    const sortedRequiredChars = [...config.chars].sort().join('');

    if (sortedCodeChars !== sortedRequiredChars) return null;

    return {
      type: prefix === 'B' ? 'BASIC' : 'PREMIUM',
      code: cleanCode,
      ...config,
    };
  }

  // =====================================================
  // STORAGE
  // =====================================================

  function getLicense() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
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

    if (!license) {
      return { valid: false, reason: 'no_license' };
    }

    // întrebări
    if (license.questionsUsed >= license.maxQuestions) {
      return {
        valid: false,
        reason: 'questions_exceeded',
        license: license,
      };
    }

    // zile rămase
    const now = Date.now();
    const elapsed = now - license.activationDate;
    const elapsedDays = Math.floor(elapsed / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, license.maxDays - elapsedDays);

    if (daysRemaining <= 0) {
      return {
        valid: false,
        reason: 'expired',
        license: license,
      };
    }

    return {
      valid: true,
      license: license,
      questionsRemaining: license.maxQuestions - license.questionsUsed,
      daysRemaining: daysRemaining,
    };
  }

  function activateLicense(code) {
    const packageData = validateCodePattern(code);
    if (!packageData) {
      return { success: false, error: 'Cod invalid' };
    }

    const licenseData = {
      code: packageData.code,
      type: packageData.type,
      maxQuestions: packageData.maxQuestions,
      maxDays: packageData.maxDays,
      activationDate: Date.now(),
      questionsUsed: 0,
    };

    saveLicense(licenseData);
    licenseJustExpired = false; // resetăm orice stare anterioară

    return {
      success: true,
      data: licenseData,
      message: `Licență ${packageData.name} activată!`,
    };
  }

  function incrementQuestions() {
    const license = getLicense();
    if (license) {
      license.questionsUsed += 1;
      saveLicense(license);
    }
  }

  // =====================================================
  // UI - MODAL LICENSE
  // =====================================================

  function createModal() {
    const modal = document.createElement('div');
    modal.id = 'triboi-license-modal';
    modal.innerHTML = `
      <style>
        #triboi-license-modal {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0, 0, 0, 0.95); backdrop-filter: blur(10px);
          z-index: 10000; display: flex; align-items: center; justify-content: center;
        }
        #triboi-license-modal .modal-content {
          background: linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%);
          border: 2px solid #2dd4bf; border-radius: 20px; padding: 40px;
          max-width: 480px; width: 90%; box-shadow: 0 20px 60px rgba(45, 212, 191, 0.4);
        }
        #triboi-license-modal h2 {
          color: #2dd4bf; margin: 0 0 10px 0; font-size: 26px;
          display: flex; align-items: center; gap: 12px;
        }
        #triboi-license-modal h2 img { height: 48px; width: auto; }
        #triboi-license-modal .subtitle { color: #94a3b8; margin: 0 0 25px 0; font-size: 14px; }
        #triboi-license-modal input {
          width: 100%; padding: 16px; border: 2px solid #334155; background: #0b1220;
          color: #e5e7eb; border-radius: 12px; font-size: 18px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 2px; text-align: center;
          font-family: 'Courier New', monospace;
        }
        #triboi-license-modal input:focus {
          outline: none; border-color: #2dd4bf; box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1);
        }
        #triboi-license-modal button {
          width: 100%; padding: 16px; border: none;
          background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%);
          color: #0b1220; border-radius: 12px; font-size: 16px; font-weight: 700;
          cursor: pointer; margin-top: 16px; transition: all 0.3s; text-transform: uppercase;
        }
        #triboi-license-modal .message { margin-top: 16px; padding: 12px; border-radius: 8px; font-size: 14px; text-align: center; }
        #triboi-license-modal .message.error { background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3); color: #ef4444; }
        #triboi-license-modal .message.success { background: rgba(45,212,191,.1); border: 1px solid rgba(45,212,191,.3); color: #2dd4bf; }
        #triboi-license-modal .info { background: rgba(100,116,139,.1); border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-top: 24px; font-size: 13px; }
        #triboi-license-modal .info-title { color: #2dd4bf; font-weight: 700; margin-bottom: 10px; }
        #triboi-license-modal .info-item { color: #cbd5e1; margin: 6px 0; }
        #triboi-license-modal .info-item strong { color: #e5e7eb; }
      </style>

      <div class="modal-content">
        <h2><img src="assets/triboi-logo.png" alt="Triboi AI Logo" /> Acces Triboi AI</h2>
        <div class="subtitle">Introdu codul tău de licență</div>

        <input type="text" id="license-input" placeholder="B/PXXXXXXX" autocomplete="off" maxlength="8"/>
        <button id="activate-btn">Activează</button>
        <div id="license-message"></div>

        <div class="info">
          <div class="info-title">📦 Pachete disponibile</div>
          <div class="info-item"><strong>BASIC:</strong> 10 întrebări • 30 zile • €20 • <span style="color:#2dd4bf;">multiple devices</span></div>
          <div class="info-item"><strong>PREMIUM:</strong> 100 întrebări • 365 zile • €100 • <span style="color:#2dd4bf;">multiple devices</span></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = document.getElementById('license-input');
    const btn = document.getElementById('activate-btn');
    const messageDiv = document.getElementById('license-message');

    btn.onclick = async () => {
      const code = input.value.trim();
      if (!code) {
        showMessage('Introdu un cod', 'error');
        return;
      }

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

    function showMessage(text, type) {
      messageDiv.className = `message ${type}`;
      messageDiv.textContent = text;
    }

    setTimeout(() => input.focus(), 100);
  }

  // =====================================================
  // UI - MODAL EXPIRED
  // =====================================================

  function showExpiredModal(status) {
    const modal = document.createElement('div');
    modal.id = 'triboi-expired-modal';
    modal.innerHTML = `
      <style>
        #triboi-expired-modal {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,.95); backdrop-filter: blur(10px);
          z-index: 10000; display: flex; align-items: center; justify-content: center;
        }
        #triboi-expired-modal .modal-content {
          background: linear-gradient(135deg, #1a1f2e 0%, #0d1117 100%);
          border: 2px solid #ef4444; border-radius: 20px; padding: 40px;
          max-width: 480px; width: 90%; text-align: center;
        }
        #triboi-expired-modal h2 { color: #ef4444; margin: 0 0 16px 0; font-size: 28px; }
        #triboi-expired-modal p { color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
        #triboi-expired-modal button {
          padding: 14px 28px; border: none;
          background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%);
          color: #0b1220; border-radius: 12px; font-size: 15px; font-weight: 700;
          cursor: pointer; margin: 8px; transition: all .3s;
        }
        #triboi-expired-modal .close-btn {
          background: transparent; border: 2px solid #334155; color: #cbd5e1;
        }
        #triboi-expired-modal .close-btn:hover { background: #334155; box-shadow: none; }
      </style>

      <div class="modal-content">
        <h2>⏰ Licență Expirată</h2>
        <p>${status.reason === 'questions_exceeded'
          ? 'Ai folosit toate întrebările disponibile.'
          : 'Licența ta a expirat.'}</p>

        <div style="margin:24px 0; padding:20px; background:rgba(45,212,191,.05); border:1px solid rgba(45,212,191,.2); border-radius:12px;">
          <div style="color:#2dd4bf; font-weight:600; margin-bottom:12px; font-size:14px;">🔑 Ai un cod nou?</div>
          <input type="text" id="renew-license-input" placeholder="B/PXXXXXXX" autocomplete="off" maxlength="8"
            style="width:100%; padding:12px; border:2px solid #334155; background:#0b1220; color:#e5e7eb; border-radius:8px; font-size:16px; font-weight:700; text-transform:uppercase; letter-spacing:2px; text-align:center; font-family:'Courier New', monospace; margin-bottom:12px;" />
          <button id="renew-activate-btn" style="width:100%; padding:12px; border:none; background:linear-gradient(135deg,#2dd4bf 0%,#14b8a6 100%); color:#0b1220; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">
            Activează cod nou
          </button>
          <div id="renew-message" style="margin-top:12px; padding:8px; border-radius:6px; font-size:13px; text-align:center; display:none;"></div>
        </div>

        <button class="close-btn" id="close-expired-btn">Închide</button>
      </div>
    `;

    document.body.appendChild(modal);

    const renewInput = document.getElementById('renew-license-input');
    const renewBtn = document.getElementById('renew-activate-btn');
    const renewMsg = document.getElementById('renew-message');
    const closeBtn = document.getElementById('close-expired-btn');

    renewBtn.onclick = function () {
      const code = renewInput.value.trim();
      if (!code) {
        showRenewMessage('Introdu un cod', 'error');
        return;
      }

      const result = activateLicense(code);

      if (result.success) {
        showRenewMessage(result.message, 'success');
        setTimeout(() => {
          modal.remove();
          unlockWidget();
          updateStatusBar();
          location.reload();
        }, 1200);
      } else {
        showRenewMessage(result.error, 'error');
        renewInput.value = '';
        renewInput.focus();
      }
    };

    renewInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') renewBtn.click();
    });

    closeBtn.onclick = function () {
      modal.remove();
    };

    function showRenewMessage(text, type) {
      renewMsg.style.display = 'block';
      renewMsg.textContent = text;
      if (type === 'error') {
        renewMsg.style.background = 'rgba(239,68,68,.1)';
        renewMsg.style.border = '1px solid rgba(239,68,68,.3)';
        renewMsg.style.color = '#ef4444';
      } else {
        renewMsg.style.background = 'rgba(45,212,191,.1)';
        renewMsg.style.border = '1px solid rgba(45,212,191,.3)';
        renewMsg.style.color = '#2dd4bf';
      }
    }

    setTimeout(() => renewInput.focus(), 100);
  }

  // =====================================================
  // UI - STATUS BAR
  // =====================================================

  function updateStatusBar() {
    const statusDiv = document.getElementById('triboiai-license-status');
    const statusText = document.getElementById('triboiai-license-text');
    if (!statusDiv || !statusText) return;

    const status = checkStatus();

    if (status.valid) {
      const { license, questionsRemaining, daysRemaining } = status;
      const typeLabel = license.type === 'BASIC' ? 'BASIC' : 'PREMIUM';

      const currentLang =
        typeof window.currentLang !== 'undefined' ? window.currentLang : 'ro';
      const questionsText =
        typeof window.translations !== 'undefined' &&
        window.translations[currentLang]
          ? window.translations[currentLang].questions
          : 'întrebări';
      const daysText =
        typeof window.translations !== 'undefined' &&
        window.translations[currentLang]
          ? window.translations[currentLang].days
          : 'zile';

      statusDiv.style.display = 'block';
      statusText.textContent = `${typeLabel} • ${questionsRemaining} ${questionsText} • ${daysRemaining} ${daysText}`;
    } else {
      statusDiv.style.display = 'none';
    }
  }

  // =====================================================
  // WIDGET CONTROL
  // =====================================================

  function lockWidget() {
    const widget = document.getElementById('triboiai-widget');
    const input = document.getElementById('triboiai-input');
    const btn = document.getElementById('triboiai-send');

    if (widget) {
      widget.style.opacity = '0.5';
      widget.style.pointerEvents = 'none';
      widget.style.filter = 'blur(4px)';
    }
    if (input) input.disabled = true;
    if (btn) btn.disabled = true;
  }

  function unlockWidget() {
    const widget = document.getElementById('triboiai-widget');
    const input = document.getElementById('triboiai-input');
    const btn = document.getElementById('triboiai-send');

    if (widget) {
      widget.style.opacity = '1';
      widget.style.pointerEvents = 'auto';
      widget.style.filter = 'none';
    }
    if (input) input.disabled = false;
    if (btn) btn.disabled = false;
  }

  // =====================================================
  // INTERCEPT QUESTIONS
  // (NU mai blocăm la întrebarea 10; blocăm la 11)
  // =====================================================

  function interceptSendButton() {
    const btn = document.getElementById('triboiai-send');
    if (!btn) return;

    btn.addEventListener(
      'click',
      function (e) {
        const status = checkStatus();

        // Hard invalid (nu ai licență sau e deja expirată pe zile înainte de a întreba)
        const hardInvalid =
          !status.valid &&
          status.reason !== 'questions_exceeded' &&
          status.reason !== 'expired'; // expired pe zile intră la hard

        if (hardInvalid) {
          e.stopImmediatePropagation();
          lockWidget();
          showExpiredModal(status);
          return false;
        }

        // Dacă am marcat că ultima întrebare a consumat licența,
        // blocăm acum (la încercarea întrebării 11)
        if (licenseJustExpired && !status.valid) {
          e.stopImmediatePropagation();
          lockWidget();
          showExpiredModal(status);
          licenseJustExpired = false;
          return false;
        }

        // Lăsăm întrebarea să plece; după ce pleacă, incrementăm contorul
        setTimeout(() => {
          incrementQuestions();
          updateStatusBar();

          const s2 = checkStatus();

          // Dacă după increment devine invalid din cauza numărului de întrebări sau a zilelor,
          // nu blocăm ACUM (trebuie să vadă răspunsul întrebării 10).
          if (
            !s2.valid &&
            (s2.reason === 'questions_exceeded' || s2.reason === 'expired')
          ) {
            licenseJustExpired = true;
            // opțional: poți afișa discret un mesaj non-blocant aici
          }
        }, 100);
      },
      true
    );
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  function init() {
    console.log('🔐 Triboi AI License System V3');

    const status = checkStatus();

    if (!status.valid) {
      lockWidget();
      if (status.reason === 'no_license') {
        createModal();
      } else {
        showExpiredModal(status);
      }
    } else {
      unlockWidget();
      updateStatusBar();
      console.log(
        `✓ Valid ${status.license.type}: ${status.questionsRemaining}Q, ${status.daysRemaining}D`
      );
    }

    interceptSendButton();
  }

  // =====================================================
  // ADMIN (doar în browser)
  // =====================================================

  if (typeof window !== 'undefined') {
    window.triboiAdmin = {
      checkStatus: checkStatus,
      clearLicense: () => {
        clearLicense();
        location.reload();
      },
      testCode: (code) => {
        const result = validateCodePattern(code);
        console.log('Validation:', result);
        return result;
      },
      addQuestions: (n) => {
        const license = getLicense();
        if (license) {
          license.questionsUsed = Math.max(0, license.questionsUsed - n);
          saveLicense(license);
          updateStatusBar();
          console.log(`Added ${n} questions`);
        }
      },
    };

    // expunem updateStatusBar pentru schimbarea limbii din index.html
    window.TriboiLicense = {
      updateStatusBar: updateStatusBar,
    };
  }

  // =====================================================
  // START
  // =====================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
