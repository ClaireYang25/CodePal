(function () {
  const ACTION = 'otpIntentSignal';
  const FILL_ACTION = 'fillOTP';
  const SENT_FLAG_KEY = '__otpIntentHighAlertSent';
  const AUTOFILL_STATE_KEY = '__otpAutofillState';
  const RESET_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
  const KEYWORD_REGEX = /(one[_\s-]?time|otp|verification|auth|security|passcode|pin|code)/i;

  if (window[SENT_FLAG_KEY]) {
    // Listener already initialized on this page
  } else {
    window[SENT_FLAG_KEY] = false;
  }

  const autofillState = window[AUTOFILL_STATE_KEY] || {
    lastInput: null,
    lastInputHints: null,
    lastIntentAt: 0,
    lastAutofillOtp: null,
    lastAutofillAt: 0
  };
  window[AUTOFILL_STATE_KEY] = autofillState;

  let lastSentAt = 0;

  const markSent = () => {
    window[SENT_FLAG_KEY] = true;
    lastSentAt = Date.now();
    setTimeout(() => {
      window[SENT_FLAG_KEY] = false;
    }, RESET_COOLDOWN_MS);
  };

  const describeInput = (input) => ({
    type: input.type,
    autocomplete: input.getAttribute('autocomplete'),
    name: input.name,
    id: input.id,
    placeholder: input.placeholder,
    ariaLabel: input.getAttribute('aria-label')
  });

  const buildInputHints = (input) => {
    if (!(input instanceof HTMLInputElement)) return null;
    return {
      id: input.id || null,
      name: input.name || null,
      placeholder: input.placeholder || null,
      autocomplete: input.getAttribute('autocomplete') || null,
      type: input.type || null,
      classList: Array.from(input.classList || []),
      formId: input.form ? input.form.id || null : null,
      formName: input.form ? input.form.name || null : null
    };
  };

  const restoreCandidateByHints = (hints) => {
    if (!hints) return null;

    if (hints.id) {
      const byId = document.getElementById(hints.id);
      if (byId instanceof HTMLInputElement) {
        return byId;
      }
    }

    const inputs = Array.from(document.querySelectorAll('input'));

    if (hints.name) {
      const match = inputs.find(input => input.name === hints.name);
      if (match) return match;
    }

    if (hints.autocomplete) {
      const match = inputs.find(input => (input.getAttribute('autocomplete') || '') === hints.autocomplete);
      if (match) return match;
    }

    if (hints.placeholder) {
      const lowerPlaceholder = hints.placeholder.toLowerCase();
      const match = inputs.find(input => (input.placeholder || '').toLowerCase() === lowerPlaceholder);
      if (match) return match;
    }

    if (Array.isArray(hints.classList) && hints.classList.length) {
      const match = inputs.find(input => hints.classList.every(cls => input.classList.contains(cls)));
      if (match) return match;
    }

    if (hints.formId) {
      const form = document.getElementById(hints.formId);
      if (form) {
        const candidate = form.querySelector('input');
        if (candidate instanceof HTMLInputElement) {
          return candidate;
        }
      }
    }

    if (hints.formName) {
      const form = document.querySelector(`form[name="${hints.formName}"]`);
      if (form) {
        const candidate = form.querySelector('input');
        if (candidate instanceof HTMLInputElement) {
          return candidate;
        }
      }
    }

    return null;
  };

  const setAutofillTarget = (input, reason) => {
    if (!(input instanceof HTMLInputElement)) return;

    try {
      if (autofillState.lastInput && autofillState.lastInput !== input) {
        autofillState.lastInput.removeAttribute('data-otp-autofill-target');
      }
    } catch (error) {
      // Ignore clean-up errors (node might be detached)
    }

    autofillState.lastInput = input;
    autofillState.lastInputHints = buildInputHints(input);
    autofillState.lastIntentAt = Date.now();

    try {
      input.setAttribute('data-otp-autofill-target', '1');
      if (reason) {
        input.setAttribute('data-otp-autofill-reason', reason);
      }
    } catch (error) {
      // Non-fatal if attributes cannot be set
    }
  };

  const sendIntent = (metadata = {}) => {
    if (window[SENT_FLAG_KEY]) return;
    markSent();
    const payload = {
      action: ACTION,
      sourceUrl: location.href,
      hostname: location.hostname,
      metadata
    };
    chrome.runtime.sendMessage(payload).catch(() => {
      // Ignore errors if the background script is not ready yet
    });
  };

  const isOtpInput = (input) => {
    if (!(input instanceof HTMLInputElement)) return false;
    const type = (input.type || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'checkbox', 'radio', 'file'].includes(type)) {
      return false;
    }

    const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
    if (autocomplete === 'one-time-code' || autocomplete === 'otp') {
      return true;
    }

    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const classes = (input.className || '').toLowerCase();

    const combined = `${ariaLabel} ${placeholder} ${name} ${id} ${classes}`;
    return KEYWORD_REGEX.test(combined);
  };

  const scanExistingInputs = () => {
    const inputs = document.querySelectorAll('input');
    for (const input of inputs) {
      if (isOtpInput(input)) {
        setAutofillTarget(input, 'initial-scan');
        if (!window[SENT_FLAG_KEY]) {
          sendIntent({ reason: 'initial-scan', inputDescriptor: describeInput(input) });
        }
        break;
      }
    }
  };

  const focusHandler = (event) => {
    const target = event.target;
    if (isOtpInput(target)) {
      setAutofillTarget(target, 'focus');
      sendIntent({ reason: 'focus', inputDescriptor: describeInput(target) });
    }
  };

  const dispatchTypingEvents = (input) => {
    const events = ['input', 'change', 'keyup'];
    for (const eventType of events) {
      try {
        const event = new Event(eventType, { bubbles: true });
        input.dispatchEvent(event);
      } catch (error) {
        // Ignore dispatch errors
      }
    }
  };

  const attemptAutofill = (otp) => {
    const normalizedOtp = String(otp || '').trim();
    if (!normalizedOtp) {
      return false;
    }

    const candidates = [];

    if (autofillState.lastInput && document.contains(autofillState.lastInput)) {
      candidates.push(autofillState.lastInput);
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement && !candidates.includes(activeElement) && isOtpInput(activeElement)) {
      candidates.push(activeElement);
    }

    const restored = restoreCandidateByHints(autofillState.lastInputHints);
    if (restored && !candidates.includes(restored)) {
      candidates.push(restored);
    }

    const allInputs = Array.from(document.querySelectorAll('input'));
    for (const input of allInputs) {
      if (isOtpInput(input) && !candidates.includes(input)) {
        candidates.push(input);
      }
    }

    const validCandidates = candidates.filter(input => {
      return input instanceof HTMLInputElement && !input.disabled && !input.readOnly && document.contains(input);
    });

    if (!validCandidates.length) {
      return false;
    }

    const target = validCandidates[0];
    try {
      target.focus({ preventScroll: true });
    } catch (error) {
      // Fallback focus without options
      try { target.focus(); } catch (_) {/* ignore */}
    }

    target.value = normalizedOtp;
    dispatchTypingEvents(target);
    return true;
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.action !== FILL_ACTION || !message.otp) {
      return false;
    }

    const success = attemptAutofill(message.otp);
    if (success) {
      autofillState.lastAutofillOtp = String(message.otp);
      autofillState.lastAutofillAt = Date.now();
      console.log('[OTP Autofill] Filled verification code automatically.');
    } else {
      console.log('[OTP Autofill] No suitable OTP input found to autofill.');
    }

    return false;
  });

  const mutationObserver = new MutationObserver(() => {
    if (!window[SENT_FLAG_KEY]) {
      scanExistingInputs();
    }
  });

  const setup = () => {
    document.addEventListener('focus', focusHandler, true);
    if (document.body) {
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
    scanExistingInputs();
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setup();
  } else {
    window.addEventListener('DOMContentLoaded', setup, { once: true });
  }
})();
