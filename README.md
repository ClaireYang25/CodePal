<div align="center">
  <img src="assets/icons/CodePal.png" alt="CodePal Logo" width="128"/>
  <h1 align="center">CodePal</h1>
  <p align="center">
    <em>Stay in your flow. We'll get the code.</em>
  </p>
</div>


### Is this you?

You're signing up for a new service. You're focused. You're in the zone. Then you see it:

**"Please enter the code we just sent to your email."**

*Ugh.* You open a new tab, search for "code", squint at the number, copy it, switch back, and paste. By then, your flow is gone.

If this is you, we should talk. We might just have the magic potion.

---

### The Magic: How It Works 🪄

CodePal watches your inbox from the background, intelligently finds the *real* verification code, and brings it directly to you.

| Step | Action | How it's done |
| :--- | :--- | :--- |
| **👂 Sense** | **Listens for new mail.** | A lightweight content script monitors your unread Gmail threads without interrupting you. |
| **🧠 Understand** | **Finds the real OTP.** | A **Gemini Nano** powered engine finds the code locally on your device, ensuring your data stays private. |
| **🚀 Act** | **Brings the code to you.** | The OTP instantly appears in the extension popup. **One click, and it's copied.** |

<br>

_The result? You stay focused. You stay secure. You stop tab-switching._

---

### Architecture at a Glance

```
┌────────┐      ┌────────────────────┐      ┌────────────┐
│ Gmail  │────▶│ gmail-monitor.js    │────▶│ background │
│ Inbox  │      │  (Content Script)   │      │ service    │
└────────┘      └────────────────────┘      │ worker     │
                                             │  ├ Regex  │
                                             │  ├ Nano   │
                                             │  └ API*   │
                                             └────┬──────┘
                                                  │
                                 ┌────────────────┴────────────────┐
                                 │                                 │
                                 ▼                                 ▼
                          ┌──────────┐                     ┌────────────────┐
                          │ CodePal  │                     │ otp-intent.js  │
                          │  Popup   │                     │ (Autofill)     │
                          └──────────┘                     └────────────────┘

*Cloud tier is disabled by default during the hackathon build.
```

---

### Core Features

*   **✨ Instant & Automatic:** The moment an OTP email arrives, the extension popup is ready with your code.
*   **🧠 Private by Design:** Powered by **Gemini Nano**, all processing happens on your device. Your emails are never sent to a server.
*   **🎯 One-Click Copy:** Click the code in the popup to instantly copy it to your clipboard.

---

### From Zero to Magic: Get Started in Seconds

1.  **Prepare Chrome**: Use Chrome 120+ and enable the Prompt API at `chrome://flags/#prompt-api-for-gemini-nano`.
2.  **Load the Extension**: Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select this project's folder.
3.  **One-Time AI Download**: The first time you open the CodePal popup, you may be prompted to download the Gemini Nano model. This is a quick, one-time setup that enables all on-device AI features.
4.  **See the Magic**: Keep a Gmail tab open in the background. When you receive an OTP email, the CodePal popup will appear automatically with your code, ready to be copied with a single click.

> **For a full testing guide**, see [`docs/TEST_DASHBOARD.md`](docs/TEST_DASHBOARD.md).

---

### 🔭 The Vision: The Path to a Truly Seamless Web

Our roadmap is focused on three key pillars:

1.  **Perfecting Hands-Free Autofill**: We are finalizing a proactive autofill system that injects the code directly into the focused input field, creating a truly zero-touch experience.

2.  **True Background Operation (OAuth2)**: The next major leap is to integrate the Gmail API via OAuth2. This will allow CodePal to run completely in the background, without requiring an open Gmail tab, making it a seamless, invisible utility.

3.  **Multimodal AI for Image OTPs**: We plan to leverage Gemini's multimodal capabilities to accurately extract verification codes from images and screenshots within emails, tackling one of the toughest challenges in automated verification.

---

### License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

