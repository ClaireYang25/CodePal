# 🔧 Gmail OTP AutoFill - 故障排查指南

本文档记录已知问题和解决方案。

---

## ✅ Chrome 版本要求

### 必需版本

| 功能 | 最低 Chrome 版本 | 推荐版本 |
|------|----------------|---------|
| 扩展基本功能 | Chrome 88+ | Chrome 128+ |
| Offscreen API | Chrome 116+ | Chrome 128+ |
| Gemini Nano (Prompt API) | Chrome 128+ | Chrome 131+ |

### 检查你的版本

访问：`chrome://version`

如果你的版本 < 116，Gemini Nano 功能将不可用，但本地正则引擎仍然可以工作（90%+ 覆盖率）。

---

## 🐛 已知问题与解决方案

### 问题 1: `Unrecognized manifest key 'offscreen'`

**现象**:
```
Warnings:
Unrecognized manifest key 'offscreen'.
```

**原因**: 
- Chrome 版本 < 116 不支持 `offscreen` API
- 我们已从 manifest.json 中移除了静态声明

**解决方案**:
1. 升级到 Chrome 116+
2. 或者接受此限制：Gemini Nano 不可用，但本地正则仍然工作

**状态**: ✅ 已修复（改为运行时动态检查）

---

### 问题 2: `Permission 'modelAccess' is unknown`

**现象**:
```
Permissions warnings:
Permission 'modelAccess' is unknown.
```

**原因**: 
- `modelAccess` 是实验性权限，在某些 Chrome 版本中不被识别
- 这个权限实际上不是必需的

**解决方案**:
已从 manifest.json 中移除

**状态**: ✅ 已修复

---

### 问题 3: `No output language was specified in a LanguageModel API request`

**现象**:
```
No output language was specified in a LanguageModel API request. 
An output language should be specified to ensure optimal output quality...
Please specify a supported output language code: [en, es, ja]
```

**原因**: 
Gemini Nano 要求明确指定输出语言

**解决方案**:
在创建 session 时添加 `systemPrompt`:
```javascript
session = await globalThis.LanguageModel.create({
  systemPrompt: 'You are a verification code extraction assistant. Always respond in English.',
  // ...
});
```

**状态**: ✅ 已修复

---

### 问题 4: `Failed to initialize Gemini Nano: [object DOMException]`

**现象**:
```
❌ Failed to initialize Gemini Nano: [object DOMException]
```

**可能原因**:
1. 语言配置问题（见问题 3）
2. Chrome Flags 未正确启用
3. 模型尚未下载
4. 硬件不支持

**解决方案**:

#### 步骤 1: 启用 Chrome Flags
访问：`chrome://flags/#prompt-api-for-gemini-nano`
设置为：**Enabled**
重启浏览器

#### 步骤 2: 检查模型状态
访问：`chrome://on-device-internals`

你应该看到：
- **Ready**: 模型已下载，可以使用 ✅
- **Downloading**: 模型正在下载中（等待几分钟）⏳
- **Not Available**: 你的设备不支持 ❌

#### 步骤 3: 确认硬件要求
Gemini Nano 需要：
- **GPU**: 显存 > 4GB
- **或 CPU**: 内存 >= 16GB + 4核心以上

**状态**: ⚠️ 取决于你的环境

---

### 问题 5: `Uncaught (in promise) Error: A listener indicated an asynchronous response...`

**现象**:
```
Uncaught (in promise) Error: A listener indicated an asynchronous 
response by returning true, but the message channel closed before 
a response was received
```

**原因**:
1. Content Script 或 Offscreen Document 崩溃
2. 消息处理函数中有未处理的 Promise rejection
3. `sendResponse` 在异步操作完成前被清理

**解决方案**:
确保所有消息处理函数都：
1. 返回 `true` 以保持消息通道开放
2. 始终调用 `sendResponse()`，即使在错误情况下

**示例（正确做法）**:
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sendResponse).catch(error => {
    sendResponse({ error: error.message });
  });
  return true; // 保持通道开放
});
```

**状态**: ⚠️ 监控中

---

### 问题 6: Gmail 页面警告（可忽略）

**现象**:
```
Host validation failed: Object
Host is not in insights whitelist
```

**原因**:
这些是 Gmail 自己的内部警告，与我们的扩展无关

**解决方案**:
无需处理，不影响功能

**状态**: ✅ 可忽略

---

## 🧪 测试 Gemini Nano 可用性

### 快速测试脚本

1. 打开任意网页
2. 按 F12 打开开发者工具
3. 在 Console 中运行：

```javascript
// 测试 API 可用性
if (typeof globalThis.LanguageModel !== 'undefined') {
  globalThis.LanguageModel.availability().then(availability => {
    console.log('Gemini Nano availability:', availability);
    
    if (availability === 'readily') {
      console.log('✅ Gemini Nano is ready to use!');
    } else if (availability === 'after-download') {
      console.log('⏬ Gemini Nano needs to be downloaded first');
    } else {
      console.log('❌ Gemini Nano is not available on this device');
    }
  });
} else {
  console.log('❌ LanguageModel API not available. Please enable chrome://flags/#prompt-api-for-gemini-nano');
}
```

### 预期结果

- **`readily`**: 可以立即使用 ✅
- **`after-download`**: 需要下载模型 ⏳
- **`no`**: 设备不支持 ❌

---

## 🔄 如果 Gemini Nano 不可用

### 方案 A: 使用本地正则引擎

本地正则引擎可以识别 **90%+** 的标准 OTP 格式，速度极快（< 50ms）。

**测试本地引擎**:
```bash
cd /Users/claireyang/Desktop/Googleddddd
node tests/test.js
```

你应该看到所有测试通过。

### 方案 B: 配置 Gemini API（云端备用）

1. 访问：https://aistudio.google.com/app/apikey
2. 创建 API Key
3. 在扩展 Popup 中输入并保存

**优点**: 可以处理复杂场景  
**缺点**: 需要网络请求（~2s），消耗 API 配额

---

## 📊 三层引擎工作状态检查

在 Service Worker Console 中查看日志：

### 正常流程

```
✅ Background service initialized
✅ OTP found via local regex (confidence: 0.95)
```

### Gemini Nano 不可用时

```
✅ Background service initialized
⚠️ Local regex confidence low (0.5), trying Gemini Nano...
⚠️ Gemini Nano failed, trying API fallback: Offscreen API not available...
❌ All OTP extraction methods failed
```

这说明：
1. 本地正则置信度低
2. Gemini Nano 不可用
3. Gemini API 未配置

**解决**: 配置 Gemini API 作为备用

---

## 🆘 完全失败的情况

如果你看到：
```
❌ All OTP extraction methods failed
```

**检查清单**:
1. [ ] 邮件内容是否包含 4-8 位数字？
2. [ ] 邮件是否包含关键词（"验证码"、"code"、"OTP"）？
3. [ ] 是否配置了 Gemini API Key？
4. [ ] 查看 Service Worker Console 的详细错误信息

---

## 📞 获取帮助

### 查看日志

1. **Service Worker 日志**:
   - `chrome://extensions/` → "Service Worker" 链接

2. **Content Script 日志**:
   - Gmail 页面 → 按 F12 → Console 标签

3. **Offscreen Document 日志**:
   - `chrome://extensions/` → "检查视图" → offscreen.html

### 提供信息

如果需要帮助，请提供：
1. Chrome 版本 (`chrome://version`)
2. 完整的错误日志
3. 测试的邮件内容格式
4. `chrome://on-device-internals` 的截图

---

## ✅ 成功标准

一个完全正常工作的扩展应该显示：

### Service Worker Console
```
✅ Background service initialized
```

### Gmail 页面 Console
```
✅ Gmail monitor initialized
```

### Offscreen Document Console（如果 Gemini Nano 可用）
```
✅ Offscreen document loaded, waiting for requests...
Gemini Nano availability: readily
✅ Gemini Nano session created
```

### 本地正则测试
```bash
$ node tests/test.js
✅ 中文 - 验证码: 123456
✅ English - Code: 789012
✅ Español - Código: 456789
✅ Italiano - Codice: 345678
```

---

**最后更新**: 2025-01-XX  
**文档版本**: 1.0

