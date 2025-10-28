# Gmail OTP AutoFill - 测试指南

既然 Gemini Nano 模型已成功下载并就绪，本文档将指导你进行完整的端到端测试。

## 前置条件

- ✅ Gemini Nano 模型已下载（`chrome://on-device-internals` 显示 "Ready"）
- ✅ 扩展已加载到 Chrome
- ✅ Gmail 账户可访问
- ✅ Chrome Flags 已启用 Prompt API

## 测试场景

### 场景 1：测试第一层（Local Regex）

**目标**：验证本地正则表达式能够快速提取标准格式的 OTP。

**步骤**：
1. 发送一封包含简单 OTP 的测试邮件到你的 Gmail，例如：
   ```
   Your verification code is: 123456
   ```
   或
   ```
   验证码：654321
   请在10分钟内输入
   ```

2. 打开 Gmail 并点开该邮件

3. 观察 Service Worker 控制台（`chrome://extensions` → 扩展详情 → "Service Worker" → "inspect"）

**预期结果**：
- 控制台显示：`✅ OTP found via LOCAL REGEX (confidence: 0.9+)`
- Popup 中显示提取的 OTP，时间戳旁边显示 `⚡ Local`

---

### 场景 2：测试第二层（Gemini Nano）

**目标**：验证 Gemini Nano 能够处理复杂或非标准格式的 OTP。

**步骤**：
1. 发送一封格式复杂的测试邮件，例如：
   ```
   Hi there,
   
   We noticed a login attempt from a new device. To verify it's really you,
   please enter this code: 7 8 9 0 1 2
   
   This code will expire in 5 minutes.
   Best regards,
   Security Team
   ```

2. 打开 Gmail 并点开该邮件

3. 同时观察：
   - Service Worker 控制台
   - Offscreen Document 控制台（`chrome://extensions` → 扩展详情 → 找到 `offscreen.html` → "inspect"）

**预期结果**：
- Service Worker 显示：
  ```
  ⚠️ Regex confidence low (0.X), moving to Tier 2...
  ✅ OTP found via GEMINI NANO (confidence: 0.X)
  ```
- Offscreen 控制台显示 Nano 会话创建和推理日志
- Popup 显示 OTP，标记为 `🤖 On-Device AI`

---

### 场景 3：测试第三层（Gemini API）- 可选

**前提**：需要配置 Gemini API Key

**步骤**：
1. 在 Popup 的设置中：
   - 开启 "Enable Cloud AI Fallback"
   - 输入有效的 Gemini API Key
   - 点击 "Save"

2. 暂时在代码中模拟 Nano 失败（用于测试回退机制）：
   - 编辑 `src/background/service-worker.js`
   - 在 Tier 2 部分添加 `throw new Error('Simulated Nano failure');`

3. 发送测试邮件并观察

**预期结果**：
- Service Worker 显示三层逐步尝试
- 最终通过 Gemini API 提取成功
- Popup 显示 `☁️ Cloud AI`

**测试完成后**：记得移除模拟失败的代码

---

## 快速验证脚本

可以在 Popup 的 DevTools Console 中运行以下脚本进行快速测试：

### 测试 Nano 推理能力

```javascript
const opts = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }]
};

const session = await LanguageModel.create(opts);
const result = await session.prompt('Extract the OTP from this text: Your code is 123456');
console.log('Nano result:', result);
```

### 测试三层引擎

```javascript
chrome.runtime.sendMessage({
  action: 'extractOTP',
  emailContent: 'Your verification code is 987654. It will expire in 10 minutes.',
  language: 'en'
}, (response) => {
  console.log('Extraction result:', response);
  console.log('Method used:', response.method);
  console.log('Confidence:', response.confidence);
});
```

---

## 验证要点

### UI 正确性
- [ ] OTP 值正确显示
- [ ] 时间戳准确（"Xs ago", "Xm ago" 等）
- [ ] 提取方法标记正确（⚡ / 🤖 / ☁️）
- [ ] 点击 OTP 可复制到剪贴板

### 控制台日志
- [ ] Service Worker 清晰显示三层尝试过程
- [ ] Offscreen（如果使用）正确初始化 Nano 会话
- [ ] 没有未处理的错误或警告

### 性能指标
- [ ] Regex 提取通常在 < 50ms 完成
- [ ] Nano 提取在 1-3 秒内完成
- [ ] API 提取时间取决于网络

---

## 常见问题排查

### 问题：Popup 不显示 OTP
**检查**：
1. Service Worker 是否成功提取？查看控制台
2. Storage 中是否保存？运行 `chrome.storage.local.get(['latestOTP'], console.log)`

### 问题：显示 "⚡ Local" 但应该用 Nano
**原因**：可能邮件格式足够简单，Regex 就能高置信度匹配
**验证**：使用更复杂的邮件格式测试

### 问题：Nano 返回 "downloadable"
**检查**：
1. 模型是否真的已下载？访问 `chrome://on-device-internals`
2. Offscreen 中 `LanguageModel.availability()` 返回什么？

---

## 测试完成检查清单

- [ ] 第一层（Regex）能正确提取标准 OTP
- [ ] 第二层（Nano）能处理复杂格式
- [ ] UI 正确显示提取方法标记
- [ ] OTP 可以点击复制
- [ ] 多次测试均稳定工作
- [ ] 控制台无错误

---

## 下一步

测试通过后，可以考虑：
1. 优化 Regex 规则以覆盖更多格式
2. 调整 Nano 的 system prompt 以提高准确率
3. 添加更多语言支持（目前为英文）
4. 性能监控与日志收集

