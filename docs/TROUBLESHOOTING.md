# 🔧 Gmail OTP AutoFill - 故障排查指南

本文档记录了开发过程中遇到的关键问题及其最终解决方案。

---

## 🚀 核心问题：Gemini Nano 模型下载失败

这是项目中最核心的挑战。现象包括：UI卡在“下载中”但进度为0%，或者UI状态在关闭后无法保持。

### 根本原因分析

1.  **用户手势 (User Gesture) 丢失**: `LanguageModel.create()` API **必须**在一个由用户直接发起的事件（如点击）中调用，才能触发模型下载。通过 Service Worker 或 Offscreen Document 间接触发常常会失败，因为手势上下文已经丢失。
2.  **架构过于复杂**: 最初，下载状态的管理逻辑分散在 `popup.js`, `service-worker.js`, 和 `offscreen.js` 中。这种分散导致了状态不一致、消息冲突和循环依赖，使问题难以定位。
3.  **消息路由冲突**: 从 Popup 发出的消息（如 `triggerNanoDownload`）同时被 Service Worker 和 Offscreen Document 监听，导致 Service Worker 拦截了本应由 Offscreen 处理的消息，并抛出 `Unknown action` 错误。
4.  **Chrome 用户配置文件损坏**: 在某些情况下，即时代码完全正确，一个“脏”的或损坏的 Chrome 用户配置文件也会阻止模型下载。

### ✅ 最终解决方案：极简架构

我们通过以下步骤彻底解决了问题：

1.  **简化下载触发器**:
    *   **唯一入口**: 移除所有在 Service Worker 和 Offscreen 中的下载相关代码。现在，**只有 `popup.js`** 负责处理模型下载。
    *   **直接调用**: 当用户点击 Popup 中的下载按钮时，我们**直接**在 `popup.js` 的点击事件处理器中调用 `LanguageModel.create()`。这确保了“用户手势”的有效性。

2.  **明确消息目标**:
    *   为了防止消息被错误的组件接收，我们为发往 Offscreen Document 的消息添加了一个 `target` 字段。
    *   **发送方 (`service-worker.js`)**:
        ```javascript
        const targetedMessage = { ...message, target: 'offscreen' };
        const response = await chrome.runtime.sendMessage(targetedMessage);
        ```
    *   **接收方 (`offscreen.js`)**:
        ```javascript
        if (request.target !== 'offscreen') {
          console.log('⏭️ Message not for offscreen, ignoring');
          return; // 忽略不属于自己的消息
        }
        ```

3.  **最终调试手段**:
    *   当代码逻辑确认无误但下载依然失败时，**创建一个全新的 Chrome 用户配置文件** (`Create a new person/profile`) 是最终的解决方案。在新环境中，模型成功下载。

---

## 🐛 其他关键问题与解决方案

### Gemini Nano & Offscreen

| 问题描述 | 原因与解决方案 |
| :--- | :--- |
| **`No output language was specified...`** | **原因**: Nano API 强制要求指定输入和输出语言以保证安全性和质量。 <br> **解决方案**: 在 `LanguageModel.create()` 和 `LanguageModel.availability()` 中明确提供 `expectedInputs` 和 `expectedOutputs` 参数。 |
| **`Failed to read the 'type' property from 'LanguageModelExpected'...`** | **原因**: `expectedOutputs` 的语法结构不正确。 <br> **解决方案**: 修正为正确的数组对象格式：`expectedOutputs: [{ type: 'text', languages: ['en'] }]`。 |
| **`popup.js` 中 `this` 上下文丢失导致 `TypeError`** | **原因**: 在 `LanguageModel.create()` 的 `monitor` 回调中使用了普通函数，导致 `this` 指向改变，无法访问 `PopupController` 实例属性。 <br> **解决方案**: 将回调改为**箭头函数**以正确绑定 `this` 上下文：`monitor: (m) => { ... }`。 |

### Manifest & 配置

| 问题描述 | 原因与解决方案 |
| :--- | :--- |
| **`Unrecognized manifest key 'offscreen'`** | **原因**: 使用的 Chrome 版本低于 116，不支持 Offscreen API。 <br> **解决方案**: 代码中加入了动态检查 `chrome.offscreen` 是否存在，进行优雅降级。 |
| **`Permission 'modelAccess' is unknown`** | **原因**: `modelAccess` 是一个实验性权限，并非所有版本都支持，且对于本项目并非必需。 <br> **解决方案**: 从 `manifest.json` 中移除该权限。 |

### UI & 状态管理

| 问题描述 | 原因与解决方案 |
| :--- | :--- |
| **UI 状态不更新 (e.g., 不显示 "下载中")** | **原因**: `popup.css` 中缺少对应状态（如 `.downloading`, `.ready`）的样式规则。 <br> **解决方案**: 添加完整的 CSS 样式来匹配不同的 AI 状态。 |
| **`chrome.storage.local.get` 抛出 `TypeError`** | **原因**: `get` 方法的参数格式错误，传入了字符串而不是预期的**数组或对象**。 <br> **解决方案**: 修正参数格式：`chrome.storage.local.get(['key1', 'key2'])`。 |

### 核心逻辑

| 问题描述 | 原因与解决方案 |
| :--- | :--- |
| **`All OTP extraction methods failed`** | **原因**: `gmail-monitor.js` (Content Script) 捕获到的邮件 DOM 元素内容为空，但依然发送给了 Service Worker。 <br> **解决方案**: 在 Content Script 和 Service Worker 中添加了双重验证，确保只有非空内容才会被处理。 |

---

## 🛠️ 调试技巧

- **查看 Offscreen Console**: 在 `chrome://extensions` 页面，找到你的扩展，点击 `Service Worker` 链接，在打开的控制台中执行 `chrome.offscreen.openDocument('src/offscreen/offscreen.html')`，即可在弹出的窗口中查看 Offscreen 的日志。
- **检查模型状态**: 访问 `chrome://on-device-internals` 查看 Gemini Nano 模型的下载状态、硬件要求和可用性。
- **使用干净的配置文件**: 如果怀疑是环境问题，务必在新的 Chrome 用户配置文件中测试。

