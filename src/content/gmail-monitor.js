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
            messageContainer: '[data-message-id]',
            bodyCandidates: ['.a3s', '.a3s.aiL', '.gmail_default', '[dir="ltr"]'],
            snippet: '.y2',
            subject: '.y6 .bog'
        };
        this.processedMessageKeys = new Set();
        this.observer = null;
        this.init();
    }

    async init() {
        try {
            await this.waitForElement(this.selectors.mainContainer);
            console.log('✅ Gmail monitor initialized');
            this.startObserver();
            this.attachClickHandler();
            // Initial scan
            this.scanForContent();
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

    startObserver() {
        const targetNode = document.querySelector(this.selectors.mainContainer);
        if (!targetNode) return;

        this.observer = new MutationObserver(() => {
            clearTimeout(this.scanTimeout);
            this.scanTimeout = setTimeout(() => this.scanForContent(), 300);
        });

        this.observer.observe(targetNode, { childList: true, subtree: true });
    }

    attachClickHandler() {
        document.addEventListener('click', (e) => {
            const thread = e.target.closest(this.selectors.threadRow + ', ' + this.selectors.threadItem);
            if (thread) {
                // Defer to allow Gmail to render the message body
                setTimeout(() => {
                    this.scanThreadList();
                    this.scanOpenedMessages();
                }, 400);
            }
        }, true);
    }

    scanForContent() {
        // 1) Opened messages: extract from message bodies
        this.scanOpenedMessages();
        // 2) Thread list view: extract from visible snippets/aria labels
        this.scanThreadList();
    }

    scanOpenedMessages() {
        const messageNodes = document.querySelectorAll(this.selectors.messageContainer);
        for (const node of messageNodes) {
            const msgId = node.getAttribute('data-message-id');
            const key = msgId || undefined;
            if (key && this.processedMessageKeys.has(key)) continue;

            const bodyText = this.extractBodyText(node);
            if (bodyText && bodyText.trim().length > 10) {
                this.sendForExtraction(bodyText);
                if (key) this.processedMessageKeys.add(key);
            }
        }
    }

    scanThreadList() {
        const rows = document.querySelectorAll(this.selectors.threadRow);
        for (const row of rows) {
            // Prefer last message id if available (more precise de-duplication)
            const lastMsgId = row.getAttribute('data-legacy-last-message-id')
                || row.querySelector('[data-legacy-last-message-id]')?.getAttribute('data-legacy-last-message-id');
            const threadId = row.getAttribute('data-thread-id') || row.querySelector(this.selectors.threadItem)?.getAttribute('data-thread-id');
            const key = lastMsgId || threadId;
            if (key && this.processedMessageKeys.has(key)) continue;

            const text = this.collectThreadText(row);
            if (text && text.length > 10) {
                this.sendForExtraction(text);
                if (key) this.processedMessageKeys.add(key);
            }
        }
    }

    collectThreadText(threadNode) {
        // Prefer aria-label since it often includes a readable summary
        const aria = (threadNode.getAttribute('aria-label') || '').trim();
        if (aria && aria.length > 10) return aria;
        // Otherwise try snippet and subject
        const snippet = (threadNode.querySelector(this.selectors.snippet)?.textContent || '').trim();
        const subject = (threadNode.querySelector(this.selectors.subject)?.textContent || '').trim();
        const combined = [subject, snippet].filter(Boolean).join(' - ').trim();
        return combined;
    }

    extractBodyText(messageContainer) {
        for (const sel of this.selectors.bodyCandidates) {
            const el = messageContainer.querySelector(sel);
            const txt = (el?.textContent || '').trim();
            if (txt && txt.length > 10) return txt;
        }
        const fallback = (messageContainer.textContent || '').trim();
        return fallback;
    }

    async sendForExtraction(content) {
        try {
            await chrome.runtime.sendMessage({
                action: 'extractOTP',
                emailContent: content
            });
        } catch (err) {
            const msg = String(err?.message || '');
            if (!msg.includes('Extension context invalidated') && !msg.includes('Receiving end does not exist')) {
                console.warn('Failed to send for extraction:', msg);
            }
        }
    }

    // Autofill listener & helpers remain unchanged
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
