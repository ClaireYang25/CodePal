# 🚀 Gmail OTP AutoFill - 快速测试指南

**测试时间**: 10-15 分钟  
**难度**: 简单 ⭐

---

## ✅ 准备工作 (3 分钟)

### 第 1 步：检查 Chrome 版本

在地址栏输入并回车：
```
chrome://version
```

**要求**: Chrome 版本 >= 128（推荐 141+）

### 第 2 步：启用 Gemini Nano

1. 在地址栏输入：`chrome://flags`
2. 搜索：`prompt-api-for-gemini-nano`
3. 从下拉菜单选择：**Enabled**
4. 点击右下角的 **Relaunch** 按钮重启浏览器

### 第 3 步：加载扩展

1. 在地址栏输入：`chrome://extensions/`
2. 打开右上角的 **"开发者模式"** 开关
3. 点击 **"加载已解压的扩展程序"**
4. 选择你的项目文件夹：`/Users/claireyang/Desktop/Googleddddd`
5. 确认扩展已加载，显示绿色"已启用"

---

## 🧪 核心功能测试 (5-8 分钟)

### 测试 A: 扩展加载检查 ✅

**步骤**:
1. 点击浏览器工具栏中的扩展图标 (拼图图标)
2. 找到并点击 "Gmail OTP AutoFill"

**预期结果**:
- 弹出窗口正常显示
- 看到 "Extension Status: Active"（绿色）
- 看到蓝色提示框："💡 Quick Tip: Keep your Gmail tab open..."

**如果失败**: 刷新 `chrome://extensions/` 页面，检查是否有错误信息

---

### 测试 B: Content Script 运行检查 ✅

**步骤**:
1. 打开新标签页，访问：`https://mail.google.com`
2. 登录你的 Gmail 账号（如果未登录）
3. **按 F12** 打开开发者工具
4. 切换到 **Console** 标签

**预期结果**:
- Console 中显示：`✅ Gmail monitor initialized`
- 无红色错误信息

**如果失败**: 
- 刷新 Gmail 页面
- 检查 `chrome://extensions/` 中扩展的 "Errors" 是否有错误

**提示**: 建议右键点击 Gmail 标签页 → 选择 **"固定标签页"**，这样它会一直保持打开

---

### 测试 C: Service Worker 检查 ✅

**步骤**:
1. 访问：`chrome://extensions/`
2. 找到 "Gmail OTP AutoFill" 扩展
3. 点击 **"Service Worker"** 链接（蓝色文字）
4. 新窗口会弹出，切换到 **Console** 标签

**预期结果**:
- 看到：`✅ Background service initialized`
- 无红色错误信息

---

### 测试 D: Gemini Nano 测试 🤖

**步骤**:
1. 点击扩展图标，打开 Popup
2. 点击 **"Test Gemini Nano"** 按钮
3. 等待 5-10 秒

**预期结果 - 成功**:
- 弹出绿色消息："Gemini Nano test successful!"
- 这说明你的设备支持 Gemini Nano

**预期结果 - 失败**:
- 如果看到红色错误："Gemini Nano not available"
- 这可能是因为：
  1. 模型还在下载中 → 访问 `chrome://on-device-internals` 查看进度
  2. 你的设备硬件不支持（需要 4GB+ 显存 或 16GB+ 内存）
  3. Chrome Flags 未正确启用

**不影响测试**: 即使 Gemini Nano 不可用，本地正则引擎仍然可以识别 90%+ 的 OTP

---

### 测试 E: 本地正则引擎测试 ⚡

**步骤**:
1. 打开终端（Terminal）
2. 进入项目目录：
```bash
cd /Users/claireyang/Desktop/Googleddddd
```
3. 运行测试脚本：
```bash
node tests/test.js
```

**预期结果**:
- 看到一系列 ✅ 成功消息
- 各种语言的 OTP 都被正确识别
- 示例输出：
  ```
  ✅ 中文 - 验证码: 123456
  ✅ English - Code: 789012
  ✅ Español - Código: 456789
  ```

**如果失败**: 
- 确认你在正确的目录
- 确认 `tests/test.js` 文件存在

---

## 🎯 端到端测试 (5-10 分钟)

### 测试 F: 真实邮件识别 📧

这是最重要的测试！

#### 步骤 1: 准备测试邮件

向你的 Gmail 账号发送一封测试邮件（可以从另一个邮箱发，或使用邮件发送服务）：

**邮件内容示例**（中文）:
```
主题: 测试验证码

您的验证码是: 123456

此验证码将在5分钟内过期。请勿告诉他人。
```

**或者英文**:
```
Subject: Test Verification Code

Your verification code is: 789012

This code will expire in 5 minutes.
```

#### 步骤 2: 监控识别过程

1. 确保 Gmail 标签页已打开
2. Gmail 页面的开发者工具（F12）已打开，Console 标签可见
3. 打开测试邮件

#### 步骤 3: 观察结果

**预期现象 1 - Console 日志**:
```
✅ Gmail monitor initialized
✅ OTP found via local regex (confidence: 0.95)
```

**预期现象 2 - 页面通知**:
- Gmail 页面右上角弹出一个绿色通知框
- 显示：`OTP Identified: 123456 [Copy]`
- 3 秒后自动消失

**预期现象 3 - Storage**:
- 在 Console 中运行以下命令：
```javascript
chrome.storage.local.get(['latestOTP'], (data) => console.log(data));
```
- 应该看到刚才识别的 OTP 数据

#### 如果通知没有出现：

**调试步骤**:
1. 查看 Console 是否有错误信息
2. 尝试再次打开邮件
3. 检查邮件内容是否包含验证码关键词（"验证码"、"code"、"OTP"等）
4. 查看 Service Worker 的 Console 日志

---

### 测试 G: 自动填充功能 ✍️ (可选)

如果你想测试自动填充，需要一个有 OTP 输入框的网站。

#### 简单测试方法：

1. 打开任意网页
2. 按 F12 打开开发者工具
3. 在 Console 中运行：
```javascript
document.body.innerHTML += '<input type="text" name="otp" placeholder="Enter OTP" style="font-size:20px; padding:10px; margin:50px;" />';
```
4. 点击刚创建的输入框（使其获得焦点）

**预期结果**:
- 如果刚才识别了 OTP，它应该自动填充到输入框
- 如果 OTP 已过期（5分钟），不会自动填充

---

## 🐛 常见问题排查

### 问题 1: "LanguageModel API not available"

**原因**: Gemini Nano 未启用或模型未下载

**解决**:
1. 访问 `chrome://flags/#prompt-api-for-gemini-nano`，确认是 **Enabled**
2. 重启浏览器
3. 访问 `chrome://on-device-internals`，查看模型下载状态
4. 如果显示 "需要下载"，等待几分钟（模型约 2GB）

### 问题 2: "Gmail monitor 未初始化"

**原因**: Content Script 未正确加载

**解决**:
1. 刷新 Gmail 页面
2. 检查 `chrome://extensions/` 中是否有错误
3. 重新加载扩展（点击扩展卡片上的刷新图标）

### 问题 3: "OTP 未被识别"

**可能原因**:
- 邮件格式不标准
- 没有包含关键词

**解决**:
1. 查看 Console 中的日志，看识别到了什么
2. 检查邮件是否包含：
   - 验证码关键词（"验证码"、"code"、"OTP"）
   - 4-8 位数字
3. 尝试使用更标准的邮件格式（参考上面的模板）

---

## ✅ 测试通过标准

如果以下项目都成功，说明你的扩展工作正常：

- [x] 扩展成功加载，无错误
- [x] Popup UI 正常显示
- [x] Content Script 在 Gmail 中初始化
- [x] Service Worker 正常运行
- [x] Gemini Nano 测试通过（或显示合理的错误）
- [x] 本地正则测试全部通过
- [x] 真实邮件中的 OTP 被成功识别
- [x] 页面通知正常显示

---

## 📝 测试报告模板

完成测试后，你可以记录：

```
测试日期: 2025-XX-XX
Chrome 版本: 
设备: 

✅ 成功项目:
- [ ] 扩展加载
- [ ] Content Script
- [ ] Service Worker
- [ ] Gemini Nano
- [ ] 本地正则
- [ ] 邮件识别
- [ ] 页面通知

❌ 失败项目:
- 

🐛 发现的问题:
-

📸 截图:
- (保存关键步骤的截图)
```

---

## 🎥 下一步：录制演示视频

测试通过后，你可以：
1. 录制完整的功能演示（< 3 分钟）
2. 重点展示：
   - 零配置安装
   - Gmail 中收到邮件
   - 自动识别并显示 OTP
   - 自动填充功能
3. 上传到 YouTube 或 Vimeo

---

**祝测试顺利！** 🚀

如果遇到任何问题，随时告诉我！

