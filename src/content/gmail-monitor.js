/**
 * Gmail OTP AutoFill - Content Script
 * Monitors Gmail page for new emails and sends their content to the service worker.
 * Its a single-responsibility script: Watch DOM -> Extract Raw Text -> Send to Background.
 */

class GmailContentMonitor {
    constructor() {
        this.selectors = {
            mainContainer: '[role="main"]',
            threadRow: '.zA', // Gmail thread row
            threadItem: '[data-thread-id]',
            snippet: '.y2',
            subject: '.y6 .bog'
        };
        this.processedStorageKey = 'processedMessageIds';
        this.maxProcessedEntries = 200;
        this.processedMessageKeys = new Set();
        this.otpKeywordPattern = /(验证码|驗證|認證|otp|one-time|verification code|security code|auth code|passcode|pin|kode verifikasi|codigo)/i;
        this.observer = null;
        this.init();
    }

    async init() {
        try {
            await this.waitForElement(this.selectors.mainContainer);
            await this.loadProcessedKeys();
            console.log('✅ Gmail monitor initialized');
            this.startObserver();
            this.attachClickHandler();
            this.listenForAutofillRequests();
            this.scanThreadList();
        } catch (error) {
            console.error('❌ Content script initialization failed:', error);
        }
    }

    waitForElement(selector) {
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(interval);
                    resolve(element);
                }
            }, 500);
        });
    }

    async loadProcessedKeys() {
        try {
            const result = await chrome.storage.local.get([this.processedStorageKey]);
            const entries = Array.isArray(result[this.processedStorageKey]) ? result[this.processedStorageKey] : [];
            entries.forEach((key) => {
                if (typeof key === 'string' && key) this.processedMessageKeys.add(key);
            });
        } catch (error) {
            console.warn('⚠️ Failed to load processed keys:', error);
        }
    }

    persistProcessedKeys() {
        const entries = Array.from(this.processedMessageKeys);
        const trimmed = entries.length > this.maxProcessedEntries
            ? entries.slice(entries.length - this.maxProcessedEntries)
            : entries;
        this.processedMessageKeys = new Set(trimmed);
        chrome.storage.local.set({ [this.processedStorageKey]: trimmed }).catch(() => {
            // Ignore storage errors (quota, etc.)
        });
    }

    addProcessedKey(key) {
        if (!key || typeof key !== 'string') return;
        this.processedMessageKeys.add(key);
        this.persistProcessedKeys();
    }

    startObserver() {
        const targetNode = document.querySelector(this.selectors.mainContainer);
        if (!targetNode) return;

        this.observer = new MutationObserver(() => {
            clearTimeout(this.scanTimeout);
            this.scanTimeout = setTimeout(() => this.scanThreadList(), 300);
        });

        this.observer.observe(targetNode, { childList: true, subtree: true });
    }

    attachClickHandler() {
        document.addEventListener('click', (e) => {
            const thread = e.target.closest(this.selectors.threadRow);
            if (thread) {
                setTimeout(() => this.scanThreadList(), 400);
            }
        }, true);
    }

    scanThreadList() {
        const rows = document.querySelectorAll(`${this.selectors.threadRow}.zE`); // Only unread threads
        for (const row of rows) {
            const lastMsgId = row.getAttribute('data-legacy-last-message-id')
                || row.querySelector('[data-legacy-last-message-id]')?.getAttribute('data-legacy-last-message-id');
            const threadId = row.getAttribute('data-thread-id')
                || row.querySelector(this.selectors.threadItem)?.getAttribute('data-thread-id');
            const key = lastMsgId || threadId;
            if (key && this.processedMessageKeys.has(key)) continue;

            const meta = this.collectMeta(row, lastMsgId, threadId);
            const aggregatedText = meta.aggregateText;
            if (!aggregatedText || aggregatedText.length < 10) continue;
            if (!this.otpKeywordPattern.test(aggregatedText)) continue;

            const contentForExtraction = meta.ariaLabel || aggregatedText;
            this.sendForExtraction(contentForExtraction, meta.payload);
            if (key) this.addProcessedKey(key);
        }
    }

    collectMeta(threadNode, messageId, threadId) {
        const aria = (threadNode.getAttribute('aria-label') || '').trim();
        const snippet = (threadNode.querySelector(this.selectors.snippet)?.textContent || '').trim();
        const subject = (threadNode.querySelector(this.selectors.subject)?.textContent || '').trim();
        const from = (threadNode.querySelector('.yX.xY .yW span')?.textContent
            || threadNode.querySelector('.yX.xY span[email]')?.textContent
            || '').trim();
        const receivedAt = threadNode.querySelector('.xW.xY span')?.getAttribute('title')
            || threadNode.querySelector('.xW.xY span')?.textContent?.trim()
            || '';
        const threadUrl = threadNode.querySelector('a')?.href || '';

        const aggregate = [subject, snippet, aria].filter(Boolean).join(' ');

        const payload = {
            from,
            subject,
            snippet,
            ariaLabel: aria,
            threadId: threadId || '',
            messageId: messageId || '',
            receivedAt,
            threadUrl
        };

        return {
            aggregateText: aggregate,
            ariaLabel: aria,
            payload
        };
    }

    async sendForExtraction(content, meta = {}) {
        try {
            await chrome.runtime.sendMessage({
                action: 'extractOTP',
                emailContent: content,
                meta
            });
        } catch (err) {
            const msg = String(err?.message || '');
            if (!msg.includes('Extension context invalidated') && !msg.includes('Receiving end does not exist')) {
                console.warn('Failed to send for extraction:', msg);
            }
        }
    }

    listenForAutofillRequests() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'fillOTP' && request.otp) {
                const filled = this.fillOtpInPage(request.otp);
                sendResponse({ success: filled });
                return false;
            }
            return false;
        });
    }

    fillOtpInPage(otp) {
        const inputs = document.querySelectorAll('input[type="text"], input[type="number"], input[type="tel"]');
        const otpKeywords = ['otp', 'verification', 'code', 'token', 'pin', 'auth'];

        for (const input of inputs) {
            const id = (input.id || '').toLowerCase();
            const name = (input.name || '').toLowerCase();
            const placeholder = (input.placeholder || '').toLowerCase();
            const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
            const isOtpInput = otpKeywords.some(k => id.includes(k) || name.includes(k) || placeholder.includes(k) || ariaLabel.includes(k));
            if (isOtpInput && !input.value) {
                input.value = otp;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                this.showToast(`OTP autofilled: ${otp}`);
                return true;
            }
        }
        this.showToast('OTP found. Click verification field to autofill.');
        return false;
    }

    showToast(message) {
        const node = document.createElement('div');
        node.textContent = message;
        node.style.cssText = `position:fixed;top:20px;right:20px;background:rgba(0,0,0,0.85);color:#fff;padding:10px 14px;border-radius:6px;z-index:999999;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.25);`;
        document.body.appendChild(node);
        setTimeout(() => node.remove(), 2500);
    }
}

if (typeof window.gmailMonitor === 'undefined') {
    window.gmailMonitor = new GmailContentMonitor();
}
