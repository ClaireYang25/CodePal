/**
 * Gmail OTP AutoFill - Offscreen Document
 * Provides window context for Gemini Nano execution
 * This is necessary because Service Workers don't have window object
 */

import { CONFIG, buildOTPPrompt } from '../config/constants.js';

let nanoSession = null;
let isInitialized = false;

/**
 * Initialize Gemini Nano session
 */
async function initializeNano() {
  try {
    // Check if LanguageModel API is available
    if (typeof globalThis.LanguageModel === 'undefined') {
      const errorMsg = 'LanguageModel API not available. Enable: chrome://flags/#prompt-api-for-gemini-nano';
      console.error(`❌ ${errorMsg}`);
      return { success: false, error: errorMsg, status: 'unavailable' };
    }

    // Check availability
    const availability = await globalThis.LanguageModel.availability();
    console.log('📊 Gemini Nano availability:', availability);
    console.log('📊 Availability type:', typeof availability);

    if (availability === 'no') {
      const errorMsg = 'Gemini Nano not available on this device. Check hardware requirements.';
      console.error(`❌ ${errorMsg}`);
      return { success: false, error: errorMsg, status: 'unavailable' };
    }

    if (availability === 'after-download') {
      console.log('⏬ Gemini Nano model needs to be downloaded...');
      // Don't create session yet. Let the user trigger it.
      return { success: false, error: 'Model needs to be downloaded.', status: 'downloadable' };
    }

    // Create session with proper output language configuration
    nanoSession = await globalThis.LanguageModel.create({
      systemPrompt: 'You are a verification code extraction assistant. Always respond in English with valid JSON format.',
      expectedOutputs: [
        { type: 'text', language: 'en' }  // Must have BOTH type and language
      ],
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          console.log(`⏬ Nano model download: ${Math.round(e.loaded * 100)}%`);
        });
      },
    });

    console.log('✅ Gemini Nano session created successfully');
    isInitialized = true;
    return { success: true, status: 'ready' };

  } catch (error) {
    console.error('❌ Failed to initialize Gemini Nano:', error);
    return { success: false, error: error.message, status: 'error' };
  }
}

/**
 * Extract OTP using Gemini Nano
 */
async function extractOTPWithNano(emailContent, language) {
  try {
    // Ensure initialization
    if (!isInitialized) {
      const initResult = await initializeNano();
      if (!initResult.success) {
        return {
          success: false,
          error: initResult.error,
          status: initResult.status
        };
      }
    }

    if (!nanoSession) {
      return {
        success: false,
        error: 'Nano session not created'
      };
    }

    // Build prompt
    const prompt = buildOTPPrompt(emailContent, language);
    
    console.log('🤖 Asking Gemini Nano to extract OTP...');
    
    // Get response from Nano
    const response = await nanoSession.prompt(prompt);
    
    console.log('📥 Nano raw response:', response);

    // Parse response
    const result = parseNanoResponse(response);
    
    return result;

  } catch (error) {
    console.error('❌ Nano extraction failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Parse Gemini Nano response
 */
function parseNanoResponse(response) {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.warn('⚠️ No JSON found in Nano response');
      return {
        success: false,
        error: 'No JSON in response'
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate parsed result
    if (!parsed.otp || parsed.confidence === undefined) {
      return {
        success: false,
        error: 'Invalid JSON structure'
      };
    }

    return {
      success: parsed.otp !== null && parsed.confidence > 0.5,
      otp: parsed.otp,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning || '',
      method: 'gemini-nano'
    };

  } catch (error) {
    console.error('❌ Failed to parse Nano response:', error);
    return {
      success: false,
      error: `Parse error: ${error.message}`
    };
  }
}

/**
 * Test Gemini Nano connection
 */
async function testNanoConnection() {
  try {
    if (!isInitialized) {
      const initResult = await initializeNano();
      if (!initResult.success) {
        // For a test, this is not a hard error, but a state to report
        return { success: true, message: initResult.error, status: initResult.status };
      }
    }

    if (!nanoSession) {
      // This case should ideally not be reached if init was successful
      return {
        success: false,
        error: 'Session not created'
      };
    }

    // Simple test prompt
    const testResult = await nanoSession.prompt('Say "Hello" in one word.');
    
    return {
      success: true,
      message: 'Gemini Nano is working',
      response: testResult
    };

  } catch (error) {
    console.error('❌ Nano test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Destroy Nano session
 */
function destroyNano() {
  if (nanoSession) {
    nanoSession.destroy();
    nanoSession = null;
    isInitialized = false;
    console.log('🗑️ Nano session destroyed');
  }
}

/**
 * Message listener - handles requests from Service Worker
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sendResponse);
  return true; // Keep channel open for async response
});

/**
 * Handle incoming messages
 */
async function handleMessage(request, sendResponse) {
  try {
    const { action } = request;

    switch (action) {
      case CONFIG.ACTIONS.OFFSCREEN_EXTRACT_OTP:
        const result = await extractOTPWithNano(
          request.emailContent,
          request.language
        );
        sendResponse(result);
        break;

      case CONFIG.ACTIONS.OFFSCREEN_TEST_CONNECTION:
        const testResult = await testNanoConnection();
        sendResponse(testResult);
        break;

      case 'destroy':
        destroyNano();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({
          success: false,
          error: 'Unknown action'
        });
    }
  } catch (error) {
    console.error('❌ Message handling error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Initialize on load
console.log('✅ Offscreen document loaded and ready');

