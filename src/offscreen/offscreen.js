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
 * Based on successful implementation pattern from FeedMeJD
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
    
    const availabilityLower = String(availability).toLowerCase();

    // Handle 'no' or 'unavailable' status
    if (availabilityLower === 'no' || availabilityLower === 'unavailable') {
      const errorMsg = 'Gemini Nano not available on this device. Check hardware requirements.';
      console.error(`❌ ${errorMsg}`);
      return { success: false, error: errorMsg, status: 'unavailable' };
    }

    // Handle 'downloadable' or 'after-download' status
    if (availabilityLower === 'after-download' || availabilityLower === 'downloadable') {
      console.log('⏬ Gemini Nano model needs to be downloaded (user gesture required)');
      // Don't create session yet. Return downloadable status for UI to handle.
      return { success: true, message: 'Model ready to download', status: 'downloadable' };
    }

    // Handle 'downloading' status
    if (availabilityLower === 'downloading') {
      console.log('⏬ Gemini Nano model is currently downloading...');
      return { success: true, message: 'Model is downloading', status: 'downloading' };
    }

    // Handle 'readily' or 'available' status - model is ready to use
    if (availabilityLower !== 'readily' && availabilityLower !== 'available') {
      console.warn('⚠️ Unexpected availability state:', availability);
      return { success: false, error: `Unexpected availability: ${availability}`, status: 'unavailable' };
    }

    // Create session - based on FeedMeJD's working implementation
    console.log('📝 Creating Nano session...');
    nanoSession = await globalThis.LanguageModel.create({
      systemPrompt: 'You are a verification code extraction assistant. Always respond in English with valid JSON format.',
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
 * Returns the current status without forcing initialization
 */
async function testNanoConnection() {
  try {
    // If already initialized and working, test it
    if (isInitialized && nanoSession) {
      const testResult = await nanoSession.prompt('Say "Hello" in one word.');
      return {
        success: true,
        status: 'ready',
        message: 'Gemini Nano is working',
        response: testResult
      };
    }

    // Not initialized yet, check availability
    const initResult = await initializeNano();
    
    // Return the init result directly - it contains the correct status
    // This could be 'downloadable', 'downloading', 'ready', or 'unavailable'
    return initResult;

  } catch (error) {
    console.error('❌ Nano test failed:', error);
    return {
      success: false,
      error: error.message,
      status: 'error'
    };
  }
}

/**
 * Force initialize Nano (when user explicitly triggers download)
 * Based on FeedMeJD's successful pattern
 */
async function forceInitializeNano() {
  try {
    console.log('🚀 Force initializing Nano (user-triggered)...');
    
    if (typeof globalThis.LanguageModel === 'undefined') {
      return { success: false, error: 'LanguageModel API not available', status: 'unavailable' };
    }

    const availability = await globalThis.LanguageModel.availability();
    console.log('📊 Current availability:', availability);
    
    const availabilityLower = String(availability).toLowerCase();

    // Check if device supports Nano at all
    if (availabilityLower === 'no' || availabilityLower === 'unavailable') {
      return { success: false, error: 'Device does not support Gemini Nano', status: 'unavailable' };
    }

    // For force download, we proceed to create() even if 'downloadable' or 'downloading'
    // The user gesture from the button click allows this
    console.log('📝 Creating session (will trigger download if needed)...');
    
    let downloadStarted = false;
    
    nanoSession = await globalThis.LanguageModel.create({
      systemPrompt: 'You are a verification code extraction assistant. Always respond in English with valid JSON format.',
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          if (!downloadStarted) {
            console.log('⏬ Model download started!');
            downloadStarted = true;
          }
          const progress = Math.round(e.loaded * 100);
          console.log(`⏬ Download progress: ${progress}%`);
        });
      },
    });

    console.log('✅ Nano session created successfully');
    isInitialized = true;
    
    // Check current availability again to determine if we're downloading or ready
    const currentAvailability = await globalThis.LanguageModel.availability();
    const currentStatus = String(currentAvailability).toLowerCase();
    
    console.log('📊 Post-create availability:', currentAvailability);
    
    if (currentStatus === 'downloading') {
      return { success: true, status: 'downloading', message: 'Model download in progress' };
    } else {
      return { success: true, status: 'ready', message: 'Session ready' };
    }

  } catch (error) {
    console.error('❌ Force init failed:', error);
    return { success: false, error: error.message, status: 'error' };
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
    console.log('📬 Offscreen received message:', JSON.stringify(request, null, 2));
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

      case 'forceDownload':
        // User clicked the download button, so we have a user gesture
        // Force initialization even if downloadable
        const downloadResult = await forceInitializeNano();
        sendResponse(downloadResult);
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

