# Test Dashboard 使用说明

## 1. 背景与目标

为了承接 Hackathon 冲刺阶段的“回归测试”与“智能自动填充”任务，我们构建了一个本地 `test-dashboard.html` 仿真页面，配合部署在 Google Apps Script 上的邮件发送脚本，以实现以下目标：

- **可重复的端到端测试**：一键触发不同类型的 OTP 邮件（简单 / 复杂 / 多语言 / 短验证码 / 非 OTP），验证提取链路的稳定性。
- **主动感知与 Autofill 验证**：页面内提供多种常见形态的 OTP 输入框，可直接测试内容脚本的高警戒信号与自动填充逻辑。
- **减少人工操作成本**：避免在 Gmail 中手动撰写测试邮件，提升回归频率与效率。

---

## 2. 文件结构

- `test-dashboard.html`
  - 本地测试页面，包含 OTP 输入框、发送测试邮件的按钮与状态提示。
- Google Apps Script（Web App）
  - 作为后端发送测试邮件，部署后获取 URL 并注入到 `test-dashboard.html` 中（`const appsScriptUrl = '...'`）。

---

## 3. 构建步骤记录

1. **创建/更新 Apps Script**
   - 访问 Google Apps Script（同一 Gmail 账户下）。
   - 粘贴 `doGet(e)` 代码，内部根据 `type` 参数构造不同格式的邮件，并发送到自己的 Gmail。
   - 将 `recipient` 修改为当前测试账户邮箱。

2. **部署为 Web App**
   - 选择 “部署 → 新建部署 → Web 应用”。
   - `执行为` 选择“我”，`谁有权访问` 选择“任何人”。
   - 完成部署后复制 Web App URL。

3. **更新测试页面**
   - 在 `test-dashboard.html` 中，将 `const appsScriptUrl = 'YOUR_APPS_SCRIPT_URL';` 替换为刚刚生成的 URL。

4. **本地打开测试页面**
   - 直接用 Chrome 打开 `test-dashboard.html`。
   - 建议同时打开 Extension 的 Service Worker 控制台，用于观察日志。

---

## 4. 使用指南

1. **Autofill 触发**
   - 在页面内任意一个 OTP 输入框中聚焦。
   - 确认后台日志中出现“高警戒”信号（待 Autofill 功能完成后可验证自动填充效果）。

2. **发送测试邮件**
   - 点击对应按钮（Simple / Complex / Multilingual / Short / Non-OTP）。
   - `status` 提示区域会显示发送结果。
   - 几秒后在 Gmail 收件箱中可看到对应测试邮件。

3. **观察插件行为**
   - 保持 Gmail 标签页在后台，观察 Service Worker 与 Popup 是否自动更新。
   - 待 Autofill 功能完成后，验证输入框是否被自动填入 OTP。

---

## 5. 后续工作

- 当前文档仅覆盖测试页面的构建与使用流程。
- 下一步计划：
  1. 在内容脚本与 Service Worker 中实现 OTP 自动填充逻辑。
  2. 完成回归测试清单（参考 `docs/HACKATHON_PLAN.md` 第二阶段）。
  3. 根据测试结果迭代 UI/UX 与文档。
