# Gmail OTP AutoFill

智能识别 Gmail 中的一次性验证码并自动填充到目标网页的 Chrome 扩展。

## ✨ 核心特性

- 🎯 **三层智能引擎**
  1. 本地正则匹配（快速、隐私）
  2. Gemini Nano（设备端AI）
  3. Gemini API（云端备用）

- 🌍 **多语言支持**：中文、英文、西班牙语、意大利语

- 🔒 **隐私优先**：本地处理为主，仅使用 `gmail.readonly` 权限

- ⚡ **自动填充**：识别后自动填充验证码输入框

## 📁 项目结构

```
Gmail-OTP-AutoFill/
├── manifest.json           # Chrome 扩展配置文件
├── src/
│   ├── background/         # 后台服务
│   │   └── service-worker.js    # Service Worker（消息路由、认证）
│   ├── content/            # 内容脚本
│   │   └── gmail-monitor.js     # Gmail 页面监听器
│   ├── core/               # 核心引擎
│   │   └── otp-engine.js        # 本地 OTP 识别引擎
│   ├── services/           # 服务层
│   │   ├── ai-service.js        # Gemini API 服务
│   │   └── gmail-service.js     # Gmail API 服务
│   ├── offscreen/          # 离屏文档（Gemini Nano）
│   │   ├── offscreen.html
│   │   └── offscreen.js
│   ├── ui/                 # 用户界面
│   │   ├── popup.html
│   │   └── popup.js
│   └── utils/              # 工具函数（预留）
├── assets/
│   └── icons/              # 扩展图标
├── docs/                   # 项目文档
│   ├── PROJECT_PITCH.md         # 项目介绍（Hackathon）
│   ├── TECH_STACK.md            # 技术栈说明
│   ├── USER_MANUAL.md           # 用户手册
│   └── DEVPOST_REVIEW.md        # Devpost 评审指南
└── tests/
    └── test.js             # 测试脚本
```

## 🚀 快速开始

### 1. 安装扩展

1. 克隆或下载本仓库
2. 打开 Chrome，进入 `chrome://extensions/`
3. 启用"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目根目录

### 2. 启用 Gemini Nano（可选）

访问 `chrome://flags` 并启用：
- `#prompt-api-for-gemini-nano`
- `#optimization-guide-on-device-model`

重启浏览器后，Chrome 会自动下载 Gemini Nano 模型。

### 3. 配置 Gemini API（可选）

1. 访问 [Google AI Studio](https://aistudio.google.com/app/apikey)
2. 获取 API 密钥
3. 在扩展弹窗中输入并保存

## 🔧 技术栈

- **Chrome Extension Manifest V3**
- **Gemini Nano** (Chrome Prompt API) - 设备端 AI
- **Gemini API** - 云端 AI 备用
- **Gmail API** - 邮件读取（`gmail.readonly`）
- **ES Modules** - 现代化模块系统

## 📖 文档

- [项目介绍](docs/PROJECT_PITCH.md) - 为什么要做这个项目
- [技术架构](docs/TECH_STACK.md) - 技术选型和架构设计
- [用户手册](docs/USER_MANUAL.md) - 如何使用
- [Devpost 指南](docs/DEVPOST_REVIEW.md) - 评审要点

## 🔐 隐私承诺

- ✅ 仅使用 `gmail.readonly` 权限（只读）
- ✅ 优先本地处理，AI 仅作增强
- ✅ 不存储完整邮件内容
- ✅ OTP 5分钟后自动失效
- ✅ 遵循最小权限原则

## 📝 开发者说明

### 代码规范

- 使用 ES6+ 语法
- 模块化设计，单一职责原则
- 详细的注释和 JSDoc

### 核心流程

1. **Gmail Monitor** 监听邮件变化
2. **OTP Engine** 本地正则匹配
3. **Offscreen Document** 调用 Gemini Nano
4. **AI Service** 云端 API 备用
5. **Auto-fill** 自动填充到输入框

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests！

## 📄 许可证

MIT License

---

**Gmail OTP AutoFill** - 让验证码填写像呼吸一样自然 🌟

