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

        // Poller for AI status during download
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
            CONFIG.STORAGE_KEYS.LATEST_OTP,
            CONFIG.STORAGE_KEYS.NANO_DOWNLOAD_STATE,
            CONFIG.STORAGE_KEYS.NANO_DOWNLOAD_STARTED_AT
        ];
        const result = await chrome.storage.local.get(keysToGet);
        
        if (result[CONFIG.STORAGE_KEYS.POPUP_SETTINGS]) {
            this.settings = { ...this.settings, ...result[CONFIG.STORAGE_KEYS.POPUP_SETTINGS] };
        }
        if (result[CONFIG.STORAGE_KEYS.GEMINI_API_KEY]) {
            this.elements.apiKeyInput.value = "••••••••••••••••";
        }
        this.updateLatestOtpDisplay(result[CONFIG.STORAGE_KEYS.LATEST_OTP]);

        // Restore AI status if a download is in progress (persisted state)
        const persistedState = result[CONFIG.STORAGE_KEYS.NANO_DOWNLOAD_STATE];
        if (persistedState === 'downloading') {
            const progress = result[CONFIG.STORAGE_KEYS.NANO_DOWNLOAD_PROGRESS];
            this.setAiStatus('downloading', progress ? `Downloading model... ${progress}%` : 'Download in progress...');
        }
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
            this.elements.otpTimestamp.textContent = `Found ${timeAgo}`;
        } else {
            this.elements.otpValue.textContent = '-- -- -- --';
            this.elements.otpTimestamp.textContent = 'Waiting for new OTP emails...';
        }
    }

    async checkNanoStatus() {
        console.log('🔍 Checking Nano status...');
        
        // Read persisted state first to avoid UI being overridden prematurely
        const persisted = await chrome.storage.local.get([CONFIG.STORAGE_KEYS.NANO_DOWNLOAD_STATE]);
        const persistedState = persisted[CONFIG.STORAGE_KEYS.NANO_DOWNLOAD_STATE];

        const response = await this.sendMessage({ action: CONFIG.ACTIONS.TEST_GEMINI_NANO });
        console.log('📬 Backend response:', response);
        
        if (!response || !response.success) {
            console.log('❌ Backend returned error');
            this.setAiStatus('error', response?.error || 'On-Device AI Unavailable');
            return;
        }
        
        // Simple status mapping
        switch (response.status) {
            case 'downloadable':
                // Guard: if user already triggered download in popup, keep "downloading"
                if (persistedState === 'downloading') {
                    console.log('✅ Persisted state is downloading → keeping downloading UI');
                    this.setAiStatus('downloading', 'Model is downloading...');
                } else {
                    console.log('✅ Status: downloadable - showing download button');
                    this.setAiStatus('download-required', 'Download On-Device AI');
                }
                break;
            case 'downloading':
                console.log('✅ Status: downloading');
                this.setAiStatus('downloading', 'Model is downloading...');
                break;
            case 'ready':
                console.log('✅ Status: ready');
                this.setAiStatus('ready', 'On-Device AI Ready');
                break;
            default:
                console.log('⚠️ Unknown status:', response.status);
                this.setAiStatus('ready', 'On-Device AI Ready');
        }
    }

    setAiStatus(status, text) {
        this.elements.aiStatusText.textContent = text;
        const spinner = this.elements.aiStatusSpinner;

        // Reset classes
        this.elements.aiStatusBar.classList.remove('ready', 'downloading', 'error', 'download-required');
        this.elements.aiStatusBar.onclick = null; // Clear previous click handlers

        if (status === 'downloading') {
            spinner.style.display = 'block';
            this.elements.aiStatusBar.classList.add('downloading');
            this.startStatusPolling();
            chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.NANO_DOWNLOAD_STATE]: 'downloading', [CONFIG.STORAGE_KEYS.NANO_DOWNLOAD_STARTED_AT]: Date.now() });
        } else if (status === 'download-required') {
            spinner.style.display = 'none';
            this.elements.aiStatusBar.classList.add('download-required');
            this.elements.aiStatusBar.onclick = () => this.triggerNanoDownload();
            this.elements.aiStatusBar.title = 'Click to start downloading the on-device AI model (approx. 400MB)';
            this.stopStatusPolling();
            chrome.storage.local.remove([CONFIG.STORAGE_KEYS.NANO_DOWNLOAD_STATE, CONFIG.STORAGE_KEYS.NANO_DOWNLOAD_STARTED_AT]);
        } else {
            spinner.style.display = 'none';
            this.elements.aiStatusBar.title = '';
            if (status === 'ready') {
                 this.elements.aiStatusBar.classList.add('ready');
                 this.stopStatusPolling();
                 chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.NANO_DOWNLOAD_STATE]: 'ready' });
            } else if (status === 'error') {
                 this.elements.aiStatusBar.classList.add('error');
                 this.stopStatusPolling();
                 chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.NANO_DOWNLOAD_STATE]: 'error' });
            }
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
        console.log('🎯 === DOWNLOAD TRIGGERED ===');
        
        try {
            // Step 1: Check if API exists
            if (typeof globalThis.LanguageModel === 'undefined') {
                console.error('❌ LanguageModel API not available');
                console.error('💡 Check chrome://flags/#prompt-api-for-gemini-nano');
                throw new Error('LanguageModel API not available');
            }
            console.log('✅ Step 1: API available');
            
            // Step 2: Check availability with DETAILED logging
            console.log('📊 Step 2: Checking availability...');
            const availability = await globalThis.LanguageModel.availability({
                expectedOutputs: [{ type: 'text', language: 'en' }]
            });
            console.log('📊 Raw availability:', availability);
            console.log('📊 Type:', typeof availability);
            console.log('📊 String:', String(availability));
            console.log('📊 Lowercase:', String(availability).toLowerCase());
            
            // Step 3: Decide UI state based on availability
            const availStr = String(availability).toLowerCase();
            
            if (availStr === 'no' || availStr === 'unavailable') {
                throw new Error('Gemini Nano not supported on this device');
            }
            
            if (availStr === 'downloadable' || availStr === 'after-download') {
                this.setAiStatus('downloading', 'Starting download...');
                console.log('⏬ Model needs download, will call create()...');
            } else if (availStr === 'downloading') {
                this.setAiStatus('downloading', 'Download in progress...');
                console.log('⏬ Model is already downloading...');
            } else if (availStr === 'readily' || availStr === 'available') {
                console.log('✅ Model is ready!');
                this.setAiStatus('ready', 'On-Device AI Ready');
                return;
            }
            
            // Step 4: Call create() to trigger/continue download
            console.log('📝 Step 4: Calling create() to trigger download...');
            
            const session = await globalThis.LanguageModel.create({
                expectedOutputs: [{ type: 'text', language: 'en' }],
                monitor(m) {
                    m.addEventListener('downloadprogress', (e) => {
                        const progress = Math.round(e.loaded * 100);
                        console.log(`⏬ DOWNLOAD PROGRESS: ${progress}%`);
                        
                        // Update UI
                        const el = document.getElementById('ai-status-text');
                        if (el) el.textContent = `Downloading model... ${progress}%`;
                        chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.NANO_DOWNLOAD_PROGRESS]: progress });
                        if (progress >= 1) {
                            chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.NANO_DOWNLOAD_STATE]: 'downloading' });
                        }
                    });
                }
            });
            
            console.log('✅ Step 5: create() completed!');
            console.log('Session type:', typeof session);
            console.log('Session has prompt:', typeof session?.prompt === 'function');
            
            // If we got a session, model is ready
            this.setAiStatus('ready', 'On-Device AI Ready');
            console.log('✅✅✅ Download complete! Model is ready to use.');
            
        } catch (error) {
            console.error('❌ ERROR in triggerNanoDownload:', error);
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
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
