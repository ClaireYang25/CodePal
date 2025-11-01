# Test Dashboard Guide

## 1. Background & Goals

To support the regression testing and autofill feature development during the hackathon sprint, we've built a local `test-dashboard.html` page. When paired with an optional Google Apps Script for sending emails, it achieves the following goals:

-   **Repeatable End-to-End Testing**: Trigger different types of OTP emails (Simple, Complex, Multilingual, Short, Non-OTP) with a single click to verify the stability of the entire extraction pipeline.
-   **Intent & Autofill Validation**: The page provides various common OTP input fields to directly test the content script's high-alert signals and autofill logic.
-   **Reduced Manual Effort**: Avoids the need to manually compose test emails in Gmail, increasing the frequency and efficiency of regression testing.

---

## 2. File Structure

-   `test-dashboard.html`
    -   The local test page containing OTP input fields, buttons to send test emails, and a status display.
-   Google Apps Script (Web App)
    -   (Optional) Acts as a backend to send test emails. Once deployed, its URL is added to `test-dashboard.html` (in `const appsScriptUrl = '...'`).

---

## 3. Setup Steps

1.  **Create/Update the Apps Script**
    -   Visit Google Apps Script under the same Google account.
    -   Paste in the `doGet(e)` code, which constructs different emails based on the `type` parameter and sends them to your own Gmail address.
    -   Update the `recipient` variable to your test email address.

2.  **Deploy as a Web App**
    -   Click "Deploy" -> "New deployment" -> "Web app".
    -   Set "Execute as" to "Me".
    -   Set "Who has access" to "Anyone".
    -   Copy the generated Web App URL after deploying.

3.  **Update the Test Page**
    -   In `test-dashboard.html`, replace `YOUR_APPS_SCRIPT_URL` in the `appsScriptUrl` constant with the URL you just copied.

4.  **Open the Test Page Locally**
    -   Open `test-dashboard.html` directly in Chrome (or preferably, via a local web server).
    -   It's recommended to have the extension's Service Worker console open to monitor logs.

---

## 4. Usage Guide

1.  **Triggering Autofill**
    -   Focus on any of the OTP input fields on the page.
    -   Confirm that a "high-alert" signal appears in the background logs. This primes the extension for autofill.

2.  **Sending Test Emails**
    -   Click the corresponding button (e.g., Simple, Complex, Multilingual, Short, Non-OTP).
    -   The status area will show the result of the send request.
    -   The test email should appear in your Gmail inbox within a few seconds.

3.  **Observing Extension Behavior**
    -   Keep a Gmail tab running in the background and observe if the Service Worker and Popup update automatically.
    -   Once the autofill feature is triggered, verify that the OTP is correctly filled into the input field you focused on.

---

## 5. Next Steps

-   This document covers the setup and usage of the test dashboard.
-   The next steps involve:
    1.  Implementing the OTP autofill logic in the content scripts and Service Worker.
    2.  Completing the regression test checklist (see Phase 2 of `docs/HACKATHON_PLAN.md`).
    3.  Iterating on UI/UX and documentation based on test results.
