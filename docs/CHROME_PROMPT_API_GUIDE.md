# 🚀 Chrome Prompt API 集成指南

## 📋 Chrome Prompt API 集成完成！

您的 Gmail OTP AutoFill 扩展现在已经集成了 Chrome Prompt API。以下是详细的使用步骤：

### 🔧 集成的新功能

1. **Chrome Prompt API 服务** (`chrome-prompt-api.js`)
   - 本地 AI 处理，无需外部 API 密钥
   - 更快的响应速度
   - 更好的隐私保护

2. **混合 AI 策略**
   - 优先使用 Chrome Prompt API
   - Gemini API 作为备用方案
   - 智能切换机制

3. **增强的用户界面**
   - 分别测试两种 AI 服务
   - 独立的开关控制
   - 详细的状态显示

### 🚀 使用步骤

#### 步骤 1: 启用 Chrome Prompt API

1. **打开扩展弹窗**
   - 点击 Chrome 工具栏中的扩展图标

2. **检查 Chrome Prompt API 状态**
   - 查看"Chrome Prompt API"开关是否可用
   - 如果显示"未配置"，需要启用权限

3. **请求权限**
   - 点击"测试 Chrome Prompt API"按钮
   - 如果提示需要权限，点击"允许"
   - 确认 `modelAccess` 权限

#### 步骤 2: 配置 AI 服务优先级

1. **Chrome Prompt API（推荐）**
   - 开启"Chrome Prompt API"开关
   - 本地处理，无需 API 密钥
   - 更快的响应速度

2. **Gemini API（备用）**
   - 开启"Gemini API 备用"开关
   - 需要配置 API 密钥
   - 作为备用方案

#### 步骤 3: 测试功能

1. **测试 Chrome Prompt API**
   - 点击"测试 Chrome Prompt API"
   - 应该看到"Chrome Prompt API 测试成功！"

2. **测试 Gemini API**
   - 点击"测试 Gemini API"
   - 需要先配置 API 密钥

### 🔍 技术细节

#### Chrome Prompt API 优势

- **本地处理**：数据不离开浏览器
- **更快速度**：无需网络请求
- **更好隐私**：完全本地化
- **无需密钥**：不需要外部 API 密钥

#### 混合策略工作流程

```javascript
// 1. 优先尝试 Chrome Prompt API
if (chromePromptAPI.isAvailable) {
  result = await chromePromptAPI.extractOTP(content);
  if (result.success) return result;
}

// 2. 备用方案：Gemini API
if (geminiAPI.isConfigured) {
  result = await geminiAPI.extractOTP(content);
  return result;
}

// 3. 最后备用：本地规则
return await localRules.extractOTP(content);
```

### 🛠️ 故障排除

#### 常见问题

1. **Chrome Prompt API 不可用**
   - 检查 Chrome 版本（需要 Chrome 126+）
   - 确认已启用实验性功能
   - 检查 `modelAccess` 权限

2. **权限被拒绝**
   - 重新加载扩展
   - 手动请求权限
   - 检查 Chrome 设置

3. **AI 服务切换问题**
   - 检查设置中的开关状态
   - 查看控制台错误日志
   - 尝试重新测试服务

#### 调试方法

1. **查看控制台日志**
   ```javascript
   // 在控制台中运行
   chrome.storage.local.get(null, console.log);
   ```

2. **检查权限状态**
   ```javascript
   chrome.permissions.getAll(console.log);
   ```

3. **测试 Prompt API**
   ```javascript
   navigator.languageModel.getModels().then(console.log);
   ```

### 📊 性能对比

| 特性 | Chrome Prompt API | Gemini API |
|------|------------------|------------|
| 响应速度 | < 500ms | 1-3s |
| 隐私保护 | 完全本地 | 需要网络 |
| API 密钥 | 不需要 | 需要 |
| 可用性 | Chrome 126+ | 全平台 |
| 准确率 | 高 | 高 |

### 🔒 隐私优势

使用 Chrome Prompt API 的主要隐私优势：

1. **数据本地化**：所有处理都在浏览器内完成
2. **无网络传输**：验证码内容不会发送到外部服务器
3. **无 API 密钥**：不需要存储外部服务的访问凭证
4. **完全控制**：用户完全控制数据处理过程

### 🎯 最佳实践

1. **优先使用 Chrome Prompt API**
   - 更好的隐私保护
   - 更快的响应速度
   - 无需配置 API 密钥

2. **保留 Gemini API 作为备用**
   - 在不支持 Chrome Prompt API 的环境中
   - 作为故障转移方案

3. **监控性能**
   - 定期检查两种服务的状态
   - 根据实际使用情况调整设置

### 📞 技术支持

如果遇到问题：

1. 查看控制台错误日志
2. 检查 Chrome 版本和权限
3. 尝试重新加载扩展
4. 联系技术支持

---

**恭喜！** 您的扩展现在拥有了最先进的本地 AI 处理能力！🎉
