# Gmail OTP AutoFill - 测试指南

本文档指导你如何测试本扩展的各项功能。

---

## ⚙️ 准备工作

### 1. 检查 Chrome 版本

确保你的 Chrome 版本 >= **v128**（建议 v141+）

```bash
在地址栏输入: chrome://version
```

### 2. 启用 Gemini Nano（设备端AI）

1. 访问 `chrome://flags`
2. 搜索并启用以下标志:
   - `#prompt-api-for-gemini-nano`（必需）
   - `#prompt-api-for-gemini-nano-multimodal-input`（可选，用于未来多模态功能）
   - `#optimization-guide-on-device-model`（推荐）
3. **重启浏览器**
4. 访问 `chrome://on-device-internals`，检查模型下载状态
   - 如果状态显示 "需要下载"，等待自动下载完成（可能需要几分钟）

### 3. 加载扩展

1. 打开 `chrome://extensions/`
2. 启用右上角的 **"开发者模式"**
3. 点击 **"加载已解压的扩展程序"**
4. 选择项目根目录（包含 `manifest.json` 的文件夹）
5. 确认扩展已加载且没有错误

---

## 🧪 功能测试

### 测试 1: 扩展 Popup UI

**目标**: 验证扩展弹窗正常显示

**步骤**:
1. 点击浏览器工具栏中的扩展图标
2. 弹窗应显示:
   - **Extension Status**: Active（激活）
   - **AI Service**: Checking...（检查中）
   - **Latest OTP**: None（无）

**预期结果**: 弹窗正常显示，UI清晰美观，无报错

---

### 测试 2: Gmail 标签页检查

**目标**: 确认 Content Script 正常运行

**步骤**:
1. 打开 `mail.google.com`（建议固定该标签页）
2. 按 F12 打开开发者工具
3. 切换到 **Console** 标签
4. 应该看到: `✅ Gmail monitor initialized`

**预期结果**:
- Content Script 成功加载
- 无红色错误信息

**提示**: 如果没有看到初始化消息，刷新 Gmail 页面

---

### 测试 3: Gemini Nano 连接测试

**目标**: 验证设备端 AI 是否正常工作

**前提条件**: 
- 已启用 `chrome://flags` 中的相关标志
- 模型已下载（检查 `chrome://on-device-internals`）

**步骤**:
1. 在扩展弹窗中点击 **"Test Gemini Nano"** 按钮
2. 等待几秒钟

**预期结果**:
- 显示 **"Gemini Nano test successful!"**
- 或显示错误信息（如模型未下载、浏览器不支持等）

**调试提示**:
- 打开开发者工具（F12），切换到 Console
- 查看 `chrome://on-device-internals` 中的模型状态
- 确认硬件要求（需要 4GB+ 显存 或 16GB+ 内存）

---

### 测试 4: Gemini API 测试（可选）

**目标**: 测试云端 AI 备用方案

**前提条件**: 需要 Gemini API Key

**步骤**:
1. 访问 [Google AI Studio](https://aistudio.google.com/app/apikey)
2. 创建并复制 API Key
3. 在扩展弹窗中:
   - 输入 API Key
   - 点击 **"Save Key"**
   - 点击 **"Test Gemini API"** 按钮

**预期结果**:
- 显示 **"Gemini API test successful!"**
- AI Service 状态变为 **"Configured"**

---

### 测试 5: 本地正则匹配引擎（Tier 1）

**目标**: 测试本地 OTP 识别规则

**步骤**:
1. 打开终端，进入项目根目录
2. 运行测试脚本:
```bash
node tests/test.js
```

**预期结果**:
- 测试用例应全部通过
- 显示各种语言的 OTP 识别结果

**示例输出**:
```
✅ 中文验证码识别成功: 123456
✅ 英文验证码识别成功: 789012
...
```

---

### 测试 6: 端到端 OTP 识别与自动填充

**目标**: 测试完整的用户流程

**前提条件**:
- 已连接 Gmail
- 至少启用了 Gemini Nano 或配置了 Gemini API

**步骤**:

#### 6.1 准备测试邮件
1. 向你的 Gmail 账号发送一封包含验证码的测试邮件
   - **示例邮件内容**:
     ```
     Subject: 登录验证码
     
     您的验证码是: 123456
     
     此验证码将在5分钟内过期。
     ```

#### 6.2 监控识别过程
1. 打开 `mail.google.com`
2. 打开浏览器开发者工具（F12）
3. 切换到 **Console** 标签
4. 在 Gmail 收件箱中打开测试邮件

#### 6.3 观察结果
- Console 中应显示识别日志:
  ```
  ✅ Gmail monitor initialized
  ✅ OTP found via local regex
  ```
- 页面右上角应弹出通知:
  ```
  OTP Identified: 123456 [Copy]
  ```
- 通知会在 3 秒后自动消失

#### 6.4 测试自动填充
1. 打开任意一个需要输入验证码的网站
2. 聚焦（点击）验证码输入框
3. 如果输入框被正确识别（包含 `otp`、`code` 等关键词），验证码应自动填充

**预期结果**:
- OTP 被成功识别
- 通知正常显示
- 自动填充功能正常

---

## 🐛 调试技巧

### 查看扩展日志

**Service Worker 日志**:
1. 打开 `chrome://extensions/`
2. 找到本扩展，点击 **"检查视图: Service Worker"**
3. 在 Console 中查看后台日志

**Content Script 日志**:
1. 打开 Gmail 页面
2. 按 F12 打开开发者工具
3. 在 Console 中查看日志

**Offscreen Document 日志**:
1. 打开 `chrome://extensions/`
2. 点击扩展的 **"检查视图"** 下的 `offscreen.html`
3. 查看 Gemini Nano 的初始化和调用日志

### 常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| "LanguageModel not available" | 未启用 Chrome Flags | 访问 `chrome://flags` 启用相关标志 |
| "Model not downloaded" | Gemini Nano 模型未下载 | 访问 `chrome://on-device-internals` 检查状态 |
| "Content script failed" | ES Module 兼容性问题 | 确认 `gmail-monitor.js` 使用内联常量 |
| OTP 未被识别 | 邮件格式不匹配 | 查看 `otp-engine.js` 中的正则规则 |
| 自动填充不工作 | 输入框关键词不匹配 | 检查 `OTP_KEYWORDS` 配置 |

### 检查存储的数据

在 Console 中运行:
```javascript
chrome.storage.local.get(null, (data) => console.log(data));
```

### 清除所有数据

在扩展弹窗中点击 **"Clear Data"** 按钮

---

## 📊 测试清单

在提交前，确保所有功能都已测试:

- [ ] 扩展加载成功，无报错
- [ ] Popup UI 显示正常
- [ ] Gmail OAuth 认证成功
- [ ] Gemini Nano 连接测试通过（或显示合理的错误信息）
- [ ] Gemini API 测试通过（如已配置）
- [ ] 本地正则测试通过
- [ ] 端到端 OTP 识别成功
- [ ] 通知正常显示
- [ ] 自动填充功能正常

---

## 🎯 下一步

测试完成后，你可以：
1. 记录测试结果和截图
2. 准备演示视频（< 3 分钟）
3. 完善 README 和文档
4. 准备 Devpost 提交材料

---

**测试愉快！** 🚀

