/**
 * Gmail OTP AutoFill - Content Script
 * Monitors Gmail page for new emails and sends their content to the service worker.
 * Its a single-responsibility script: Watch DOM -> Extract Raw Text -> Send to Background.
 */

class GmailContentMonitor {
    constructor() {
        this.selectors = {
            mainContainer: '[role="main"]',
            emailThread: '[data-thread-id]',
            emailBody: '.adn.ads' // A more specific and stable selector for the main body
        };
        this.processedEmailIds = new Set();
        this.observer = null;
        this.init();
    }

    async init() {
        try {
            await this.waitForElement(this.selectors.mainContainer);
            console.log('✅ Gmail monitor initialized');
            this.startObserver();
            this.listenForAutofillRequests();
            // Initial scan for any emails already on the page
            this.scanForNewEmails();
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

        this.observer = new MutationObserver((mutations) => {
            // A simple debounce to avoid rapid-fire scans
            clearTimeout(this.scanTimeout);
            this.scanTimeout = setTimeout(() => this.scanForNewEmails(mutations), 500);
        });

        this.observer.observe(targetNode, {
            childList: true,
            subtree: true
        });
    }

    scanForNewEmails(mutations = []) {
        const emailBodies = document.querySelectorAll(this.selectors.emailBody);

        for (const emailBody of emailBodies) {
            // Find the closest parent with a message ID to use as a unique identifier
            const messageContainer = emailBody.closest('[data-message-id]');
            if (!messageContainer) continue;

            const messageId = messageContainer.getAttribute('data-message-id');
            if (this.processedEmailIds.has(messageId)) {
                continue;
            }

            const content = emailBody.textContent || '';
            if (content.trim().length > 10) {
                console.log(`💌 New email detected (ID: ${messageId}), sending to service worker...`);
                chrome.runtime.sendMessage({
                    action: 'extractOTP',
                    emailContent: content
                }).catch(err => console.error("Message sending failed:", err));
                this.processedEmailIds.add(messageId);
            }
        }
    }

    listenForAutofillRequests() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'fillOTP' && request.otp) {
                this.fillOtpInPage(request.otp);
                sendResponse({ success: true });
            }
            // Return false as we are not responding asynchronously in all cases
            return true;
        });
    }

    fillOtpInPage(otp) {
        // Broad search for potential OTP inputs across the entire document
        const inputs = document.querySelectorAll('input[type="text"], input[type="number"], input[type="tel"]');
        const otpKeywords = ['otp', 'verification', 'code', 'token', 'pin', 'auth'];

        for (const input of inputs) {
            const id = (input.id || '').toLowerCase();
            const name = (input.name || '').toLowerCase();
            const placeholder = (input.placeholder || '').toLowerCase();
            const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
            
            const isOtpInput = otpKeywords.some(keyword => 
                id.includes(keyword) ||
                name.includes(keyword) ||
                placeholder.includes(keyword) ||
                ariaLabel.includes(keyword)
            );

            if (isOtpInput && !input.value) {
                console.log(`🖋️ Found OTP input field, filling with: ${otp}`);
                input.value = otp;
                // Dispatch events to simulate manual input, helping frameworks like React detect the change
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                return; // Stop after filling the first found field
            }
        }
    }
}

// Ensure the script runs only once
if (typeof window.gmailMonitor === 'undefined') {
    window.gmailMonitor = new GmailContentMonitor();
}
