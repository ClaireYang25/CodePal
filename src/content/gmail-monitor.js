/**
 * Gmail OTP AutoFill - Content Script
 * Monitors Gmail page for new emails and sends their content to the service worker.
 * Its a single-responsibility script: Watch DOM -> Extract Raw Text -> Send to Background.
 */

class GmailContentMonitor {
    constructor() {
        this.selectors = {
            mainContainer: '[role="main"]',
            threadItem: '[data-thread-id]',
            messageContainer: '[data-message-id]',
            // Candidates frequently seen in Gmail DOM for the opened message body
            bodyCandidates: ['.a3s', '.a3s.aiL', '.gmail_default', '[dir="ltr"]'],
            // Snippet element used in thread list view
            snippet: '.y2'
        };
        this.processedMessageIds = new Set();
        this.processedThreadIds = new Set();
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
            this.scanTimeout = setTimeout(() => this.scanForContent(), 400);
        });

        this.observer.observe(targetNode, { childList: true, subtree: true });
    }

    attachClickHandler() {
        document.addEventListener('click', (e) => {
            const thread = e.target.closest(this.selectors.threadItem);
            if (thread) {
                const threadId = thread.getAttribute('data-thread-id');
                // Defer to allow Gmail to render the message body
                setTimeout(() => {
                    this.scanThreadSnippet(thread);
                    this.scanOpenedMessages();
                    if (threadId) this.processedThreadIds.add(threadId);
                }, 500);
            }
        }, true);
    }

    scanForContent() {
        // 1) Opened messages: extract from message bodies
        this.scanOpenedMessages();
        // 2) Thread list view: extract from visible snippets
        this.scanThreadList();
    }

    scanOpenedMessages() {
        const messageNodes = document.querySelectorAll(this.selectors.messageContainer);
        for (const node of messageNodes) {
            const msgId = node.getAttribute('data-message-id');
            if (!msgId || this.processedMessageIds.has(msgId)) continue;

            const bodyText = this.extractBodyText(node);
            if (bodyText && bodyText.trim().length > 10) {
                this.sendForExtraction(bodyText);
                this.processedMessageIds.add(msgId);
            }
        }
    }

    scanThreadList() {
        const threads = document.querySelectorAll(this.selectors.threadItem);
        for (const thread of threads) {
            const threadId = thread.getAttribute('data-thread-id');
            if (threadId && this.processedThreadIds.has(threadId)) continue;
            this.scanThreadSnippet(thread);
            if (threadId) this.processedThreadIds.add(threadId);
        }
    }

    scanThreadSnippet(threadNode) {
        if (!threadNode) return;
        const snippetEl = threadNode.querySelector(this.selectors.snippet);
        const text = (snippetEl?.textContent || '').trim();
        if (text && text.length > 10) {
            this.sendForExtraction(text);
        }
    }

    extractBodyText(messageContainer) {
        // Try multiple candidates under this message container
        for (const sel of this.selectors.bodyCandidates) {
            const el = messageContainer.querySelector(sel);
            const txt = (el?.textContent || '').trim();
            if (txt && txt.length > 10) return txt;
        }
        // Fallback to full container text
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
            // Common when extension reloads; ignore
            const msg = String(err?.message || '');
            if (!msg.includes('Extension context invalidated') && !msg.includes('Receiving end does not exist')) {
                console.warn('Failed to send for extraction:', msg);
            }
        }
    }
}

// Ensure the script runs only once
if (typeof window.gmailMonitor === 'undefined') {
    window.gmailMonitor = new GmailContentMonitor();
}
