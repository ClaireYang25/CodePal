/**
 * Gmail OTP AutoFill - Popup Controller
 * Manages the redesigned, minimalist popup UI
 */

import { CONFIG } from '../config/constants.js';

class PopupController {
    constructor() {
        this.elements = {
            statusIndicator: document.getElementById('extension-status'),
            otpValue: document.getElementById('otp-value'),
            otpTimestamp: document.getElementById('otp-timestamp'),
            otpDisplay: document.getElementById('otp-display'),
            aiStatusBar: document.getElementById('ai-status-bar'),
            aiStatusSpinner: document.querySelector('.spinner-light'),
            aiStatusText: document.getElementById('ai-status-text'),
            settingsToggle: document.getElementById('settings-toggle'),
            settingsPanel: document.getElementById('settings-panel'),
            cloudFallbackToggle: document.getElementById('cloud-fallback-toggle'),
            apiKeySection: document.getElementById('api-key-section'),
            apiKeyInput: document.getElementById('api-key-input'),
            saveApiKey: document.getElementById('save-api-key'),
            clearData: document.getElementById('clear-data'),
        };

        this.settings = {
            cloudFallback: false,
        };

        this.statusPoller = null;

        this.init();
    }

    async init() {
        this.addEventListeners();
        await this.loadSettings();
        this.updateUI();
        this.checkNanoStatus();
        this.updateLatestOtpDisplay();

        // Listen for updates from the background script
        chrome.runtime.onMessage.addListener((request) => {
            if (request.action === 'otpUpdated') {
                this.updateLatestOtpDisplay();
            }
        });
    }

    addEventListeners() {
        this.elements.settingsToggle.addEventListener('click', () => this.toggleSettingsPanel());
        this.elements.cloudFallbackToggle.addEventListener('change', () => this.handleCloudFallbackToggle());
        this.elements.saveApiKey.addEventListener('click', () => this.saveApiKey());
        this.elements.clearData.addEventListener('click', () => this.clearData());
        this.elements.otpDisplay.addEventListener('click', () => this.copyOtpToClipboard());
    }

    async loadSettings() {
        const keysToGet = [
            CONFIG.STORAGE_KEYS.POPUP_SETTINGS,
            CONFIG.STORAGE_KEYS.GEMINI_API_KEY,
            CONFIG.STORAGE_KEYS.LATEST_OTP
        ];
        const result = await chrome.storage.local.get(keysToGet);
        
        if (result[CONFIG.STORAGE_KEYS.POPUP_SETTINGS]) {
            this.settings = { ...this.settings, ...result[CONFIG.STORAGE_KEYS.POPUP_SETTINGS] };
        }
        if (result[CONFIG.STORAGE_KEYS.GEMINI_API_KEY]) {
            this.elements.apiKeyInput.value = "••••••••••••••••";
        }
        this.updateLatestOtpDisplay(result[CONFIG.STORAGE_KEYS.LATEST_OTP]);
    }

    async saveSettings() {
        await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.POPUP_SETTINGS]: this.settings });
    }
    
    updateUI() {
        // Main status indicator (we assume it's active if the popup can be opened)
        this.elements.statusIndicator.className = 'status-indicator-active';
        this.elements.statusIndicator.title = 'Extension is active';

        // Settings panel
        this.elements.cloudFallbackToggle.checked = this.settings.cloudFallback;
        if (this.settings.cloudFallback) {
            this.elements.apiKeySection.className = 'api-key-section-visible';
        } else {
            this.elements.apiKeySection.className = 'api-key-section-hidden';
        }
    }

    async updateLatestOtpDisplay(latestOtpData = null) {
        let latestOtp = latestOtpData;
        if (!latestOtp) {
            const result = await chrome.storage.local.get([CONFIG.STORAGE_KEYS.LATEST_OTP]);
            latestOtp = result[CONFIG.STORAGE_KEYS.LATEST_OTP];
        }

        if (latestOtp && latestOtp.otp) {
            this.elements.otpValue.textContent = latestOtp.otp;
            const timeAgo = this.formatTimeAgo(latestOtp.timestamp);
            const methodBadge = this.getMethodBadge(latestOtp.method);
            this.elements.otpTimestamp.textContent = `Found ${timeAgo} ${methodBadge}`;
        } else {
            this.elements.otpValue.textContent = '-- -- -- --';
            this.elements.otpTimestamp.textContent = 'Waiting for new OTP emails...';
        }
    }

    getMethodBadge(method) {
        const badges = {
            'regex': '⚡ Local',
            'gemini-nano': '🤖 On-Device AI',
            'gemini-api': '☁️ Cloud AI'
        };
        return badges[method] || '';
    }

    async checkNanoStatus() {
        console.log('🔍 Checking Nano status...');

        try {
            if (typeof globalThis.LanguageModel === 'undefined') {
                this.setAiStatus('error', 'On-Device AI Unavailable');
                return;
            }

            const opts = {
                expectedInputs: [{ type: 'text', languages: ['en'] }],
                expectedOutputs: [{ type: 'text', languages: ['en'] }]
            };

            const availability = await globalThis.LanguageModel.availability(opts);
            const status = String(availability).toLowerCase();
            console.log('📊 availability:', status);

            // Simplified status handling: focus on ready/unavailable states
            if (status === 'readily' || status === 'available') {
                this.setAiStatus('ready', 'On-Device AI Ready');
            } else if (status === 'downloadable' || status === 'after-download') {
                this.setAiStatus('download-required', 'Download On-Device AI');
            } else if (status === 'downloading') {
                this.setAiStatus('downloading', 'Model is downloading...');
            } else {
                this.setAiStatus('error', 'On-Device AI Unavailable');
            }
        } catch (e) {
            console.log('❌ availability check failed:', e?.message || e);
            this.setAiStatus('error', 'On-Device AI Unavailable');
        }
    }

    setAiStatus(status, text) {
        this.elements.aiStatusText.textContent = text;
        const spinner = this.elements.aiStatusSpinner;

        // Reset classes
        this.elements.aiStatusBar.classList.remove('ready', 'downloading', 'error', 'download-required');
        this.elements.aiStatusBar.onclick = null;
        this.elements.aiStatusBar.title = '';

        if (status === 'ready') {
            spinner.style.display = 'none';
            this.elements.aiStatusBar.classList.add('ready');
            this.stopStatusPolling();
        } else if (status === 'downloading') {
            spinner.style.display = 'block';
            this.elements.aiStatusBar.classList.add('downloading');
            this.startStatusPolling();
        } else if (status === 'download-required') {
            spinner.style.display = 'none';
            this.elements.aiStatusBar.classList.add('download-required');
            this.elements.aiStatusBar.onclick = () => this.triggerNanoDownload();
            this.elements.aiStatusBar.title = 'Click to start downloading the on-device AI model (approx. 400MB)';
            this.stopStatusPolling();
        } else if (status === 'error') {
            spinner.style.display = 'none';
            this.elements.aiStatusBar.classList.add('error');
            this.stopStatusPolling();
        }
    }

    startStatusPolling() {
        if (this.statusPoller) return;
        // Re-check status every 10 seconds while popup is open
        this.statusPoller = setInterval(() => {
            this.checkNanoStatus();
        }, 10000);
    }

    stopStatusPolling() {
        if (!this.statusPoller) return;
        clearInterval(this.statusPoller);
        this.statusPoller = null;
    }

    async triggerNanoDownload() {
        console.log('🎯 Triggering Nano model download...');
        
        try {
            if (typeof globalThis.LanguageModel === 'undefined') {
                throw new Error('LanguageModel API not available. Check chrome://flags/#prompt-api-for-gemini-nano');
            }
            
            this.setAiStatus('downloading', 'Starting download...');
            console.log('📝 Calling create() with user gesture...');
            
            const session = await globalThis.LanguageModel.create({
                expectedInputs: [{ type: 'text', languages: ['en'] }],
                expectedOutputs: [{ type: 'text', languages: ['en'] }],
                monitor: (m) => {
                    m.addEventListener('downloadprogress', (e) => {
                        const progress = Math.round(e.loaded * 100);
                        console.log(`⏬ Download progress: ${progress}%`);
                        const el = document.getElementById('ai-status-text');
                        if (el) el.textContent = `Downloading model... ${progress}%`;
                    });
                }
            });
            
            console.log('✅ Model downloaded and session created');
            this.setAiStatus('ready', 'On-Device AI Ready');
            
        } catch (error) {
            console.error('❌ Download failed:', error);
            this.setAiStatus('error', error.message || 'Download failed');
        }
    }

    toggleSettingsPanel() {
        const panel = this.elements.settingsPanel;
        if (panel.className === 'settings-panel-hidden') {
            panel.className = 'settings-panel-visible';
        } else {
            panel.className = 'settings-panel-hidden';
        }
    }

    handleCloudFallbackToggle() {
        this.settings.cloudFallback = this.elements.cloudFallbackToggle.checked;
        this.saveSettings();
        this.updateUI();
    }
    
    async saveApiKey() {
        const apiKey = this.elements.apiKeyInput.value;
        if (apiKey && apiKey !== "••••••••••••••••") {
            await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.GEMINI_API_KEY]: apiKey });
            this.elements.apiKeyInput.value = "••••••••••••••••";
            // You might want to add a success message here
        }
    }
    
    async clearData() {
        if (confirm("Are you sure you want to clear the cached OTP and API key?")) {
            await chrome.storage.local.remove([
                CONFIG.STORAGE_KEYS.LATEST_OTP,
                CONFIG.STORAGE_KEYS.GEMINI_API_KEY
            ]);
            this.elements.apiKeyInput.value = "";
            this.updateLatestOtpDisplay();
            // You might want to add a success message here
        }
    }

    async copyOtpToClipboard() {
        const otp = this.elements.otpValue.textContent;
        if (otp && !otp.includes('-')) {
            await navigator.clipboard.writeText(otp);
            const originalText = this.elements.otpTimestamp.textContent;
            this.elements.otpTimestamp.textContent = 'Copied to clipboard!';
            setTimeout(() => {
                this.elements.otpTimestamp.textContent = originalText;
            }, 2000);
        }
    }
    
    sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const seconds = Math.floor((now - timestamp) / 1000);
      
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
      }
}

new PopupController();
