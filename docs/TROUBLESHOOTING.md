# 🔧 Gmail OTP AutoFill - 开发问题日志

本文档按时间顺序记录了开发过程中遇到的主要问题及其解决方案。

---

### 问题 1: [早期架构] 使用 Gmail API 导致认证流程复杂
- **背景**: 项目最早期的原型尝试使用 Gmail API 来读取邮件。
- **现象**: 每次使用都需要用户进行复杂的 Google 账号授权（OAuth 2.0），增加了用户的操作步骤和学习成本，也引发了关于数据权限的安全疑虑。
- **解决方案**: 我们果断放弃了 Gmail API，转向使用 **Content Script**。通过直接在 Gmail 页面内注入脚本来监听和读取新邮件的 DOM，架构变得更简单、更安全，并且完全无需用户进行任何额外的授权操作，实现了“即装即用”的体验。

### 问题 2: [Manifest] 出现 `Unrecognized manifest key 'offscreen'` 警告
- **背景**: 在 `manifest.json` 中添加 `offscreen` 权限后。
- **现象**: 加载扩展时，`chrome://extensions` 页面出现此警告。
- **原因**: 使用的 Chrome 浏览器版本低于 116，该版本尚不支持 `manifest.json` 中的 `offscreen` 字段。
- **解决方案**: 为了向前兼容，我们在代码中加入了动态检查 `if (chrome.offscreen)`，只有在 API 存在时才调用它，从而实现优雅降级。对于低版本浏览器，Nano 功能将不可用，但扩展的其余部分不受影响。

### 问题 3: [Manifest] 出现 `Permission 'modelAccess' is unknown'` 警告
- **背景**: `manifest.json` 配置阶段。
- **现象**: 加载扩展时出现关于 `modelAccess` 权限的警告。
- **原因**: `modelAccess` 是一个实验性的、且在某些 Chrome 版本中已被弃用的权限。它对于我们使用的 Prompt API 并非必需。
- **解决方案**: 从 `manifest.json` 的 `permissions` 数组中彻底移除该权限声明。

### 问题 4: [Nano 集成] 测试失败 - `Offscreen API not available`
- **背景**: 首次尝试在 Service Worker 中直接调用 Gemini Nano API。
- **现象**: 测试 Nano 功能时总是失败，并提示 Offscreen API 不可用。
- **原因**: Service Worker 是一个没有 `window` 和 DOM API 的执行环境，而 Gemini Nano（Prompt API）**必须**在拥有 `window` 对象的环境中运行。
- **解决方案**: 明确了必须使用 Offscreen Document。我们将其设计为 Service Worker 调用 Gemini Nano 的唯一桥梁：Service Worker 将任务通过消息传递给 Offscreen Document，后者在具备 `window` 的环境中执行 Nano API，然后将结果返回。这彻底解决了 Service Worker 的环境限制问题。

### 问题 5: [Nano API] 调用警告 - `No output language was specified...`
- **背景**: 在 Offscreen Document 中首次成功调用 `LanguageModel.create()`。
- **现象**: 在 Offscreen 控制台中出现警告，提示没有为 LanguageModel API 请求指定输出语言。
- **原因**: Nano API 强制要求明确指定输入和输出语言，以保证安全性和输出质量。
- **解决方案**: 在 `LanguageModel.create()` 和 `LanguageModel.availability()` 的调用中，都明确提供了 `expectedInputs` 和 `expectedOutputs` 参数，例如：`expectedOutputs: [{ type: 'text', languages: ['en'] }]`。

### 问题 6: [Nano API] 调用错误 - `Failed to read the 'type' property...`
- **背景**: 在解决上一个语言警告问题时。
- **现象**: 调用 Nano API 时抛出 `TypeError`，指示 `expectedOutputs` 格式错误。
- **原因**: `expectedOutputs` 的语法结构不正确，最初可能写成了 `language: 'en'` 而不是标准要求的 `languages: ['en']`。
- **解决方案**: 修正为 API 文档要求的标准数组对象格式：`expectedOutputs: [{ type: 'text', languages: ['en'] }]`。

### 问题 7: [消息路由] 测试时出现 `Unknown action` 错误
- **背景**: 在 Popup、Service Worker 和 Offscreen 三者之间联调时。
- **现象**: 从 popup 点击“测试Nano”按钮后，Service Worker 控制台报错 `Unknown action`。
- **原因**: 消息路由冲突。发往 Offscreen Document 用于测试连接的消息，被 Service Worker 错误地拦截并处理了，但 Service Worker 的消息处理器中并没有定义相应的 action。
- **解决方案**: 实施了**消息目标系统**。在从 Service Worker 发往 Offscreen Document 时，为消息增加 `target: 'offscreen'` 属性。同时，在 Offscreen 和 Service Worker 的消息监听器中都加入了对 `target` 属性的检查，从而确保每个组件只处理发给自己的消息。

### 问题 8: [核心逻辑] 邮件处理失败 - `All OTP extraction methods failed`
- **背景**: 联调 Content Script 和 Service Worker 时。
- **现象**: 新邮件到达后，Service Worker 报错，提示所有提取方法都失败了。
- **原因**: `gmail-monitor.js` (Content Script) 捕获到的邮件 DOM 元素内容有时为空字符串 `""`，但这个空字符串依然被发送到了 Service Worker 进行处理，导致后续所有处理逻辑失败。
- **解决方案**: 在 Content Script 和 Service Worker 中添加了**双重非空验证**。Content Script 在发送消息前检查邮件内容是否为空，Service Worker 在接收到消息后再次检查，确保只有包含实际内容的邮件才会被送入提取引擎。

### 问题 9: [存储 API] 调用 `chrome.storage.local.get` 抛出 `TypeError`
- **背景**: 调试 Popup UI 和设置持久化时。
- **现象**: 在加载 popup 或保存设置时，控制台报告 `TypeError`。
- **原因**: 调用 `chrome.storage.local.get` 方法时传入了错误的参数格式。例如，错误地传入了字符串 `CONFIG.STORAGE_KEYS.LATEST_OTP`，而 API 预期接收的是一个**包含键名的数组**或**一个定义了默认值的对象**。
- **解决方案**: 修正所有 `chrome.storage.local.get` 的调用，确保参数格式正确，例如：`chrome.storage.local.get([CONFIG.STORAGE_KEYS.LATEST_OTP])`。

### 问题 10: [UI] 界面状态不更新
- **背景**: 调试 Nano 模型下载流程时。
- **现象**: 点击下载按钮后，UI 文本没有变化，或者状态更新不正确（例如，不显示 "下载中"）。
- **原因**: `popup.css` 中缺少对应状态（如 `.downloading`, `.ready`, `.error`）的样式规则。JavaScript 逻辑虽然正确地添加了 class，但因为没有对应的 CSS，所以视觉上没有变化。
- **解决方案**: 为 `ai-status-bar` 元素添加了完整的 CSS 样式，以匹配不同的 AI 状态，确保 UI 能够准确反映后台的真实状态。

### 问题 11: [核心挑战] Gemini Nano 模型下载失败 (UI 卡顿、无进度)
- **背景**: 这是项目中最棘手、持续时间最长的问题。
- **现象**: UI卡在“下载中”但进度始终为0%，或者UI状态在关闭popup后无法保持，`chrome://on-device-internals` 显示模型安装未完成。
- **综合原因**:
    1.  **用户手势丢失**: `LanguageModel.create()` API **必须**在一个由用户直接发起的事件（如点击）中调用才能触发下载。我们最初通过 Service Worker 或 Offscreen 间接触发的方式常常导致手势上下文丢失。
    2.  **架构过于复杂**: 下载状态的管理逻辑分散在 `popup.js`, `service-worker.js`, 和 `offscreen.js` 中，导致了状态不一致、消息冲突和循环依赖。
    3.  **Chrome 用户配置文件损坏**: 在某些情况下，即时代码完全正确，一个“脏”的或损坏的 Chrome 用户配置文件也会阻止模型下载。
- **最终解决方案**:
    1.  **架构简化**: 移除了所有在 Service Worker 和 Offscreen 中的下载相关代码。**只有 `popup.js`** 负责处理模型下载。
    2.  **保证用户手势**: 当用户点击 Popup 中的下载按钮时，我们**直接**在 `popup.js` 的点击事件处理器中调用 `LanguageModel.create()`，确保了“用户手势”的有效性。
    3.  **更换配置文件**: 当代码逻辑确认无误但下载依然失败时，**创建一个全新的 Chrome 用户配置文件** (`Create a new person/profile`) 是最终的解决方案。在新环境中，模型成功下载。

### 问题 12: [下载后] `popup.js` 中 `this` 上下文丢失导致 `TypeError`
- **背景**: 在模型下载成功后，`monitor` 回调被触发时。
- **现象**: `popup.js` 控制台抛出 `TypeError: Cannot read properties of undefined`，通常与 `noProgressTimerId` 等实例属性相关。
- **原因**: 在 `LanguageModel.create()` 的 `monitor` 回调中使用了普通函数 `function(m){...}`，导致 `this` 的上下文改变，不再指向 `PopupController` 的实例。
- **解决方案**: 将回调函数改为**箭头函数** `monitor: (m) => { ... }`，箭头函数不会创建自己的 `this` 上下文，因此可以正确地从父作用域捕获并使用 `PopupController` 的实例。

---

## 🛠️ 调试技巧

- **查看 Offscreen Console**: 在 `chrome://extensions` 页面，找到你的扩展，点击 `Service Worker` 链接，在打开的控制台中执行 `chrome.offscreen.openDocument('src/offscreen/offscreen.html')`，即可在弹出的窗口中查看 Offscreen 的日志。
- **检查模型状态**: 访问 `chrome://on-device-internals` 查看 Gemini Nano 模型的下载状态、硬件要求和可用性。
- **使用干净的配置文件**: 如果怀疑是环境问题，务必在新的 Chrome 用户配置文件中测试。

