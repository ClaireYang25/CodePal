(function () {
  const ACTION = 'otpIntentSignal';
  const SENT_FLAG_KEY = '__otpIntentHighAlertSent';
  const RESET_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
  const KEYWORD_REGEX = /(one[_\s-]?time|otp|verification|auth|security|passcode|pin|code)/i;

  if (window[SENT_FLAG_KEY]) {
    return;
  }
  window[SENT_FLAG_KEY] = false;

  let lastSentAt = 0;

  const markSent = () => {
    window[SENT_FLAG_KEY] = true;
    lastSentAt = Date.now();
    setTimeout(() => {
      window[SENT_FLAG_KEY] = false;
    }, RESET_COOLDOWN_MS);
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
    if (window[SENT_FLAG_KEY]) return;
    const inputs = document.querySelectorAll('input');
    for (const input of inputs) {
      if (isOtpInput(input)) {
        sendIntent({ reason: 'initial-scan', inputDescriptor: describeInput(input) });
        break;
      }
    }
  };

  const describeInput = (input) => {
    return {
      type: input.type,
      autocomplete: input.getAttribute('autocomplete'),
      name: input.name,
      id: input.id,
      placeholder: input.placeholder,
      ariaLabel: input.getAttribute('aria-label')
    };
  };

  const focusHandler = (event) => {
    const target = event.target;
    if (isOtpInput(target)) {
      sendIntent({ reason: 'focus', inputDescriptor: describeInput(target) });
    }
  };

  const mutationObserver = new MutationObserver(() => {
    if (window[SENT_FLAG_KEY]) return;
    scanExistingInputs();
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
