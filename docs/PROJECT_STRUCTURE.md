# 项目结构说明

## 📁 完整目录树

```
Gmail-OTP-AutoFill/
│
├── 📄 manifest.json                 # Chrome 扩展配置文件
├── 📄 README.md                     # 项目说明文档
├── 📄 .gitignore                    # Git 忽略配置
│
├── 📂 src/                          # 源代码目录
│   │
│   ├── 📂 background/               # 后台服务 (Service Worker)
│   │   └── service-worker.js        # 主后台脚本
│   │       - Gmail OAuth 认证
│   │       - 消息路由与转发
│   │       - AI 服务调度
│   │       - 三层智能引擎控制
│   │
│   ├── 📂 content/                  # 内容脚本 (注入 Gmail 页面)
│   │   └── gmail-monitor.js         # Gmail 页面监听器
│   │       - DOM 变化监听
│   │       - 邮件内容提取
│   │       - OTP 自动填充
│   │       - 用户通知显示
│   │
│   ├── 📂 core/                     # 核心业务逻辑
│   │   └── otp-engine.js            # OTP 识别引擎
│   │       - 多语言正则规则
│   │       - 本地快速匹配
│   │       - 置信度计算
│   │       - 语言自动检测
│   │
│   ├── 📂 services/                 # 外部服务集成
│   │   ├── ai-service.js            # Gemini API 服务
│   │   │   - API 调用封装
│   │   │   - Prompt 构建
│   │   │   - 响应解析
│   │   │   - 重试机制
│   │   │
│   │   └── gmail-service.js         # Gmail API 服务
│   │       - 邮件列表获取
│   │       - 邮件详情提取
│   │       - Base64 解码
│   │       - 邮件内容解析
│   │
│   ├── 📂 offscreen/                # 离屏文档 (Gemini Nano)
│   │   ├── offscreen.html           # HTML 容器
│   │   └── offscreen.js             # Nano 运行脚本
│   │       - Gemini Nano 初始化
│   │       - 模型下载管理
│   │       - Prompt 处理
│   │       - 结果返回
│   │
│   ├── 📂 ui/                       # 用户界面
│   │   ├── popup.html               # 弹窗 HTML
│   │   └── popup.js                 # 弹窗控制器
│   │       - 状态显示
│   │       - 设置管理
│   │       - API 密钥配置
│   │       - 测试功能
│   │
│   └── 📂 utils/                    # 工具函数 (预留)
│
├── 📂 assets/                       # 静态资源
│   └── 📂 icons/                    # 扩展图标
│       ├── icon16.png               # 16x16 图标
│       ├── icon48.png               # 48x48 图标
│       ├── icon128.png              # 128x128 图标
│       ├── icon-templates.svg       # SVG 模板
│       └── ICON_CREATION_GUIDE.md   # 图标设计指南
│
├── 📂 docs/                         # 项目文档
│   ├── PROJECT_PITCH.md             # 项目介绍 (Hackathon)
│   ├── TECH_STACK.md                # 技术栈与架构
│   ├── USER_MANUAL.md               # 用户使用手册
│   ├── DEVPOST_REVIEW.md            # Devpost 评审指南
│   └── PROJECT_STRUCTURE.md         # 项目结构说明 (本文档)
│
└── 📂 tests/                        # 测试文件
    └── test.js                      # OTP 引擎测试
```

## 🔍 核心文件详解

### 1. `manifest.json` - 扩展配置文件

**作用**：定义扩展的元数据、权限、资源和脚本。

**关键配置**：
```json
{
  "manifest_version": 3,
  "permissions": ["activeTab", "storage", "identity", "scripting", "offscreen"],
  "optional_permissions": ["modelAccess"],
  "background": { "service_worker": "src/background/service-worker.js" },
  "content_scripts": [{ "js": ["src/content/gmail-monitor.js"] }],
  "offscreen": { "path": "src/offscreen/offscreen.html" }
}
```

### 2. `src/background/service-worker.js` - 后台服务

**核心职责**：
- 🔐 处理 Gmail OAuth 认证
- 📨 接收和转发消息（Content Script ↔ Offscreen Document）
- 🤖 控制三层智能引擎的调用顺序
- 💾 管理数据存储

**消息处理流程**：
```
Content Script 发送消息
    ↓
Service Worker 接收
    ↓
根据 action 类型路由
    ├─ authenticate → Gmail 认证
    ├─ extractOTP → 三层引擎处理
    ├─ testGeminiNano → 测试 Nano
    └─ testGeminiAPI → 测试 API
```

### 3. `src/content/gmail-monitor.js` - Gmail 页面监听

**核心职责**：
- 👀 使用 `MutationObserver` 监听 Gmail DOM 变化
- 📧 提取新邮件的文本内容
- ✍️ 检测 OTP 输入框并自动填充
- 🔔 显示绿色通知条（验证码已识别）

**关键技术**：
```javascript
// DOM 监听
const observer = new MutationObserver((mutations) => {
  // 处理邮件变化
});

// 自动填充
input.value = otp;
input.dispatchEvent(new Event('input', { bubbles: true }));
```

### 4. `src/core/otp-engine.js` - OTP 识别引擎

**核心职责**：
- 🌍 多语言正则规则（中、英、西、意）
- 🎯 快速本地匹配（< 10ms）
- 📊 置信度计算（0-1 分数）
- 🔍 语言自动检测

**支持的语言**：
```javascript
{
  zh: /验证码[：:]\s*(\d{4,8})/i,
  en: /verification code[：:]\s*(\d{4,8})/i,
  es: /código de verificación[：:]\s*(\d{4,8})/i,
  it: /codice di verifica[：:]\s*(\d{4,8})/i
}
```

### 5. `src/services/ai-service.js` - Gemini API 服务

**核心职责**：
- 🌐 调用 Gemini 1.5 Flash API
- 📝 构建智能 Prompt
- 🔄 自动重试机制（最多 3 次）
- 📊 响应解析和验证

**API 调用示例**：
```javascript
const response = await fetch(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  }
);
```

### 6. `src/services/gmail-service.js` - Gmail API 服务

**核心职责**：
- 📬 获取最新邮件列表
- 📄 提取邮件详情（主题、正文、发件人）
- 🔓 Base64 解码邮件内容
- 🧩 处理 MIME 多部分邮件

**API 端点**：
```
GET https://gmail.googleapis.com/gmail/v1/users/me/messages
GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}
```

### 7. `src/offscreen/offscreen.js` - Gemini Nano 运行环境

**核心职责**：
- 🧠 初始化 Gemini Nano 模型
- 🪟 提供窗口上下文（Service Worker 无此环境）
- ⏬ 管理模型下载进度
- 📤 接收 Service Worker 消息并返回结果

**关键 API**：
```javascript
// 检查可用性
const availability = await globalThis.LanguageModel.availability();

// 创建会话
const session = await globalThis.LanguageModel.create();

// 发送 Prompt
const result = await session.prompt(promptText);
```

### 8. `src/ui/popup.js` - 弹窗控制器

**核心职责**：
- 📊 显示连接状态（Gmail、AI）
- ⚙️ 管理用户设置（自动填充、通知等）
- 🔑 保存 Gemini API 密钥
- 🧪 测试 Nano 和 API 连接

**UI 交互**：
```javascript
// 连接 Gmail
button.onclick = async () => {
  const response = await chrome.runtime.sendMessage({ action: 'authenticate' });
  if (response.success) showSuccess();
};
```

## 🔄 数据流向

### 完整的 OTP 识别流程

```
1️⃣ 用户打开 Gmail 邮件
       ↓
2️⃣ gmail-monitor.js 监听到 DOM 变化
       ↓
3️⃣ 提取邮件文本内容
       ↓
4️⃣ 发送消息到 service-worker.js
       ↓
5️⃣ 【第一层】调用 otp-engine.js 本地匹配
       ├─ 成功 (置信度 > 0.8) → 直接返回 ✅
       └─ 失败 → 进入第二层
           ↓
6️⃣ 【第二层】发送消息到 offscreen.js
       ├─ Gemini Nano 识别成功 → 返回结果 ✅
       └─ 失败/不可用 → 进入第三层
           ↓
7️⃣ 【第三层】调用 ai-service.js (Gemini API)
       └─ 云端识别 → 返回结果 ✅
           ↓
8️⃣ 结果返回到 gmail-monitor.js
       ↓
9️⃣ 显示通知 + 存储 OTP
       ↓
🔟 用户点击 OTP 输入框 → 自动填充 ✨
```

## 🎨 命名规范

### 文件命名
- ✅ 使用 **kebab-case**（横线连接）
- ✅ 示例：`service-worker.js`, `gmail-monitor.js`, `otp-engine.js`

### 类命名
- ✅ 使用 **PascalCase**（大驼峰）
- ✅ 示例：`BackgroundService`, `GmailMonitor`, `OTPEngine`

### 函数命名
- ✅ 使用 **camelCase**（小驼峰）
- ✅ 示例：`extractOTP()`, `checkAuthentication()`, `buildPrompt()`

### 常量命名
- ✅ 使用 **UPPER_SNAKE_CASE**（大写下划线）
- ✅ 示例：`OFFSCREEN_DOCUMENT_PATH`, `MAX_RETRIES`

## 📦 模块依赖关系

```
manifest.json
    ├── src/background/service-worker.js
    │       ├── src/core/otp-engine.js
    │       ├── src/services/ai-service.js
    │       └── src/services/gmail-service.js
    │
    ├── src/content/gmail-monitor.js
    │       (通过 chrome.runtime.sendMessage 与 service-worker 通信)
    │
    ├── src/offscreen/offscreen.js
    │       (通过 chrome.runtime.sendMessage 与 service-worker 通信)
    │
    └── src/ui/popup.js
            (通过 chrome.runtime.sendMessage 与 service-worker 通信)
```

## ✅ 设计原则

1. **单一职责原则 (SRP)**
   - 每个文件/模块专注一个功能
   - 便于测试和维护

2. **开放封闭原则 (OCP)**
   - 易于扩展（添加新语言、新邮箱）
   - 无需修改核心代码

3. **依赖倒置原则 (DIP)**
   - 通过消息通信解耦
   - 模块间不直接依赖

4. **接口隔离原则 (ISP)**
   - 清晰的消息接口（action 类型）
   - 各模块只处理自己关心的消息

## 🚀 快速定位功能

| 功能 | 文件位置 |
|-----|---------|
| 修改正则规则 | `src/core/otp-engine.js` |
| 调整 AI Prompt | `src/services/ai-service.js` 或 `src/offscreen/offscreen.js` |
| 修改 Gmail 认证 | `src/background/service-worker.js` |
| 调整通知样式 | `src/content/gmail-monitor.js` |
| 修改弹窗界面 | `src/ui/popup.html` 和 `popup.js` |
| 添加新权限 | `manifest.json` |

---

**项目结构说明** - 清晰、模块化、易于维护的架构设计 🏗️

