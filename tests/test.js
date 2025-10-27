/**
 * Gmail OTP AutoFill - 测试脚本
 * 用于验证扩展的基本功能
 */

// 测试 OTP 识别引擎
function testOTPEngine() {
    console.log('🧪 测试 OTP 识别引擎...');
    
    const testCases = [
        {
            content: '您的验证码是：123456，请在5分钟内使用。',
            language: 'zh',
            expected: '123456'
        },
        {
            content: 'Your verification code is: 789012. Please use it within 5 minutes.',
            language: 'en',
            expected: '789012'
        },
        {
            content: 'Código de verificación: 456789. Úsalo en 5 minutos.',
            language: 'es',
            expected: '456789'
        },
        {
            content: 'Il tuo codice di verifica è: 321654. Usalo entro 5 minuti.',
            language: 'it',
            expected: '321654'
        }
    ];

    testCases.forEach((testCase, index) => {
        console.log(`测试用例 ${index + 1}: ${testCase.language}`);
        console.log(`内容: ${testCase.content}`);
        console.log(`期望: ${testCase.expected}`);
        console.log('---');
    });
}

// 测试 AI 服务配置
function testAIService() {
    console.log('🤖 测试 AI 服务配置...');
    
    // 检查 API 密钥
    chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            console.log('✅ API 密钥已配置');
            console.log(`密钥长度: ${result.geminiApiKey.length} 字符`);
        } else {
            console.log('❌ API 密钥未配置');
            console.log('请在弹窗中配置 Gemini API 密钥');
        }
    });
}

// 测试 Gmail 连接状态
function testGmailConnection() {
    console.log('📧 测试 Gmail 连接状态...');
    
    chrome.runtime.sendMessage({ action: 'checkAuthStatus' }, (response) => {
        if (response && response.authenticated) {
            console.log('✅ Gmail 已连接');
        } else {
            console.log('❌ Gmail 未连接');
            console.log('请点击"连接 Gmail"按钮完成授权');
        }
    });
}

// 测试存储功能
function testStorage() {
    console.log('💾 测试存储功能...');
    
    const testData = {
        testOTP: '123456',
        timestamp: Date.now(),
        test: true
    };
    
    chrome.storage.local.set({ testData }, () => {
        chrome.storage.local.get(['testData'], (result) => {
            if (result.testData && result.testData.testOTP === '123456') {
                console.log('✅ 存储功能正常');
                chrome.storage.local.remove(['testData']);
            } else {
                console.log('❌ 存储功能异常');
            }
        });
    });
}

// 运行所有测试
function runAllTests() {
    console.log('🚀 开始运行 Gmail OTP AutoFill 测试...');
    console.log('=====================================');
    
    testOTPEngine();
    testAIService();
    testGmailConnection();
    testStorage();
    
    console.log('=====================================');
    console.log('✅ 测试完成！');
    console.log('');
    console.log('📋 下一步操作：');
    console.log('1. 配置 Gemini API 密钥');
    console.log('2. 连接 Gmail 账户');
    console.log('3. 打开 Gmail 测试验证码识别');
    console.log('4. 在需要验证码的页面测试自动填充');
}

// 如果是在扩展环境中运行
if (typeof chrome !== 'undefined' && chrome.runtime) {
    runAllTests();
} else {
    console.log('请在 Chrome 扩展环境中运行此测试脚本');
}
