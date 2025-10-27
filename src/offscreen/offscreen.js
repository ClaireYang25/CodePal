/**
 * Gmail OTP AutoFill - Offscreen Document
 * Runs Gemini Nano in a window context
 */

import { CONFIG, buildOTPPrompt } from '../config/constants.js';

let session = null;
let isInitialized = false;

/**
 * Initialize Gemini Nano
 */
async function initializeNano() {
  try {
    if (typeof globalThis.LanguageModel === 'undefined') {
      console.error('❌ LanguageModel API not available');
      console.error('Please enable: chrome://flags/#prompt-api-for-gemini-nano');
      return false;
    }

    const availability = await globalThis.LanguageModel.availability();
    console.log('Gemini Nano availability:', availability);

    if (availability === 'no') {
      console.error('❌ Gemini Nano not available on this device');
      return false;
    }

    if (availability === 'after-download') {
      console.log('⏬ Gemini Nano needs to be downloaded...');
    }

    // Create session
    session = await globalThis.LanguageModel.create({
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          console.log(`⏬ Model download: ${Math.round(e.loaded * 100)}%`);
        });
      },
    });

    console.log('✅ Gemini Nano session created');
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Gemini Nano:', error);
    return false;
  }
}

/**
 * Listen for messages from Service Worker
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleRequest(request, sendResponse);
  return true; // Keep message channel open
});

/**
 * Handle incoming requests
 */
async function handleRequest(request, sendResponse) {
  const handlers = {
    [CONFIG.ACTIONS.OFFSCREEN_EXTRACT_OTP]: handleExtractOTP,
    [CONFIG.ACTIONS.OFFSCREEN_TEST_CONNECTION]: handleTestConnection
  };

  const handler = handlers[request.action];
  if (handler) {
    await handler(request, sendResponse);
  } else {
    sendResponse({ success: false, error: 'Unknown action' });
  }
}

/**
 * Extract OTP using Gemini Nano
 */
async function handleExtractOTP(request, sendResponse) {
  try {
    // Ensure initialization
    if (!isInitialized) {
      const success = await initializeNano();
      if (!success) {
        sendResponse({
          success: false,
          error: 'Gemini Nano not available. Check chrome://flags settings.'
        });
        return;
      }
    }

    if (!session) {
      sendResponse({ success: false, error: 'Session not created' });
      return;
    }

    const prompt = buildOTPPrompt(request.emailContent, request.language);
    const result = await session.prompt(prompt);
    const parsed = parseResponse(result);
    
    sendResponse(parsed);
  } catch (error) {
    console.error('❌ OTP extraction failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Test Gemini Nano connection
 */
async function handleTestConnection(request, sendResponse) {
  try {
    if (!isInitialized) {
      const success = await initializeNano();
      if (!success) {
        sendResponse({ success: false, error: 'Gemini Nano not available' });
        return;
      }
    }

    if (!session) {
      sendResponse({ success: false, error: 'Session not created' });
      return;
    }

    const result = await session.prompt(CONFIG.PROMPTS.TEST_CONNECTION);
    sendResponse({
      success: true,
      message: 'Gemini Nano connected',
      response: result
    });
  } catch (error) {
    console.error('❌ Test failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Parse Gemini Nano response
 */
function parseResponse(response) {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'No JSON found in response' };
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      success: result.otp !== null && result.confidence > 0.5,
      otp: result.otp,
      confidence: result.confidence || 0,
      reasoning: result.reasoning || '',
      method: 'gemini-nano'
    };
  } catch (error) {
    return {
      success: false,
      error: `Parsing failed: ${error.message}`
    };
  }
}

console.log('✅ Offscreen document loaded, waiting for requests...');
