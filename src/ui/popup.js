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
            this.elements.otpTimestamp.textContent = `Found ${timeAgo}`;
        } else {
            this.elements.otpValue.textContent = '-- -- -- --';
            this.elements.otpTimestamp.textContent = 'Waiting for new OTP emails...';
        }
    }

    async checkNanoStatus() {
        this.setAiStatus('loading', 'Checking On-Device AI...');
        
        const response = await this.sendMessage({ action: CONFIG.ACTIONS.TEST_GEMINI_NANO });
        console.log('📬 Popup received response from Service Worker:', JSON.stringify(response, null, 2));

        if (response && response.success) {
            if (response.status === 'downloading') {
                this.setAiStatus('downloading', 'Model is downloading...');
            } else if (response.status === 'downloadable') {
                this.setAiStatus('download-required', 'Download On-Device AI');
            } else if (response.status === 'ready') {
                this.setAiStatus('ready', 'On-Device AI Ready');
            } else {
                // Handle cases where success is true but status is unexpected
                this.setAiStatus('ready', 'On-Device AI Ready');
            }
        } else {
             this.setAiStatus('error', response?.error || 'On-Device AI Unavailable');
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
        } else if (status === 'download-required') {
            spinner.style.display = 'none';
            this.elements.aiStatusBar.classList.add('download-required');
            this.elements.aiStatusBar.onclick = () => this.triggerNanoDownload();
            this.elements.aiStatusBar.title = 'Click to start downloading the on-device AI model (approx. 400MB)';
        } else {
            spinner.style.display = 'none';
            this.elements.aiStatusBar.title = '';
            if (status === 'ready') {
                 this.elements.aiStatusBar.classList.add('ready');
            } else if (status === 'error') {
                 this.elements.aiStatusBar.classList.add('error');
            }
        }
    }

    async triggerNanoDownload() {
        this.setAiStatus('downloading', 'Starting download...');
        
        // Send the forceDownload action which will create the session with user gesture
        const result = await this.sendMessage({ action: 'triggerNanoDownload' });
        
        if (result.success) {
            // Download started successfully
            this.setAiStatus('downloading', 'Downloading model...');
            // Check status periodically
            this.checkDownloadProgress();
        } else {
            // Download failed
            this.setAiStatus('error', result.error || 'Download failed');
        }
    }

    async checkDownloadProgress() {
        // Check every 2 seconds
        const checkInterval = setInterval(async () => {
            const status = await this.sendMessage({ action: CONFIG.ACTIONS.TEST_GEMINI_NANO });
            
            if (status.success && status.status === 'ready') {
                // Download complete!
                clearInterval(checkInterval);
                this.setAiStatus('ready', 'On-Device AI Ready');
            } else if (!status.success && status.status !== 'downloading') {
                // Error occurred
                clearInterval(checkInterval);
                this.setAiStatus('error', 'Download failed');
            }
            // If still downloading, keep checking
        }, 2000);

        // Stop checking after 5 minutes (timeout)
        setTimeout(() => clearInterval(checkInterval), 5 * 60 * 1000);
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
