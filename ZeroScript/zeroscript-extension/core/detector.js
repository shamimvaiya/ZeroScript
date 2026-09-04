// SPDX-License-Identifier: GPL-3.0-or-later
// core/detector.js - Semantic DOM discovery for "Add AI Website" Provider Builder.
// Analyzes a target web page to automatically detect chat composer, send button,
// stop button, message containers, and code blocks without manual code editing.

/* eslint-disable no-unused-vars */
const ZSDetector = (() => {
  "use strict";

  /**
   * Produce a clean, robust CSS selector for a given DOM element.
   */
  function generateSelector(el, rootDoc) {
    const doc = rootDoc || (el && el.ownerDocument) || (typeof document !== "undefined" ? document : null);
    if (!el || !doc) return "";

    // 1. If element has an ID that doesn't look auto-generated or hashed
    if (el.id && !/[:\d]{4,}|[a-f0-9]{8,}/i.test(el.id)) {
      const idSel = `#${CSS.escape(el.id)}`;
      if (doc.querySelectorAll(idSel).length === 1) return idSel;
    }

    // 2. Data attributes for test/qa
    for (const attr of ["data-testid", "data-qa", "data-component", "name"]) {
      const val = el.getAttribute(attr);
      if (val) {
        const attrSel = `[${attr}="${CSS.escape(val)}"]`;
        if (doc.querySelectorAll(attrSel).length === 1) return attrSel;
      }
    }

    // 3. Aria role + label
    const role = el.getAttribute("role");
    const ariaLabel = el.getAttribute("aria-label");
    if (role && ariaLabel) {
      const ariaSel = `[role="${CSS.escape(role)}"][aria-label="${CSS.escape(ariaLabel)}"]`;
      if (doc.querySelectorAll(ariaSel).length === 1) return ariaSel;
    }
    if (ariaLabel && !role) {
      const tag = el.tagName.toLowerCase();
      const ariaSel = `${tag}[aria-label="${CSS.escape(ariaLabel)}"]`;
      if (doc.querySelectorAll(ariaSel).length === 1) return ariaSel;
    }

    // 4. Stable class name combinations
    const tag = el.tagName.toLowerCase();
    if (el.classList && el.classList.length > 0) {
      const stableClasses = Array.from(el.classList).filter((c) => !/^[a-f0-9]{6,}|css-[a-z0-9]+/i.test(c));
      if (stableClasses.length > 0) {
        const classSel = `${tag}.${stableClasses.map((c) => CSS.escape(c)).join(".")}`;
        if (doc.querySelectorAll(classSel).length === 1) return classSel;
      }
    }

    // 5. Fallback: tag + role or tag alone
    if (role) return `${tag}[role="${CSS.escape(role)}"]`;
    if (el.getAttribute("contenteditable") === "true") return `${tag}[contenteditable="true"]`;
    return tag;
  }

  /**
   * Search and score likely chat input elements.
   */
  function detectEditor(doc) {
    const candidates = [];
    const elements = doc.querySelectorAll(
      'textarea, [contenteditable="true"], [role="textbox"], input[type="text"]'
    );

    for (const el of elements) {
      let score = 0;
      const tag = el.tagName.toLowerCase();
      const placeholder = (el.getAttribute("placeholder") || "").toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const idOrClass = ((el.id || "") + " " + (el.className || "")).toLowerCase();

      if (tag === "textarea") score += 15;
      if (el.getAttribute("contenteditable") === "true") score += 14;
      if (el.getAttribute("role") === "textbox") score += 10;

      // Check placeholder clues
      if (/message|prompt|ask|chat|type|say|anything/i.test(placeholder)) score += 12;
      if (/message|prompt|ask|chat|input/i.test(aria)) score += 10;
      if (/composer|chat-input|editor|prompt-textarea/i.test(idOrClass)) score += 8;

      // Penalize search bars or tiny inputs
      if (/search|find|query/i.test(placeholder) || /search/i.test(aria)) score -= 15;

      candidates.push({ el, score, selector: generateSelector(el, doc) });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.length > 0 ? candidates[0] : null;
  }

  /**
   * Search and score likely send buttons.
   */
  function detectSendButton(doc, editorEl) {
    const candidates = [];
    const elements = doc.querySelectorAll(
      'button, [role="button"], input[type="submit"]'
    );

    for (const el of elements) {
      let score = 0;
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const title = (el.getAttribute("title") || "").toLowerCase();
      const text = (el.textContent || "").trim().toLowerCase();
      const idOrClass = ((el.id || "") + " " + (el.className || "")).toLowerCase();
      const isSubmit = el.getAttribute("type") === "submit";

      if (isSubmit) score += 8;
      if (/send|submit|ask/i.test(aria) || /send|submit|ask/i.test(title)) score += 15;
      if (/^(send|ask|generate|submit)$/i.test(text)) score += 12;
      if (/send-button|submit-btn|send_btn/i.test(idOrClass)) score += 10;

      // Check for SVG icon containing arrow or paperplane
      const svgs = el.querySelectorAll("svg");
      if (svgs.length > 0) score += 4;

      // Proximity to editor if editor exists
      if (editorEl && editorEl.parentElement) {
        if (editorEl.parentElement.contains(el) || (editorEl.form && editorEl.form.contains(el))) {
          score += 6;
        }
      }

      candidates.push({ el, score, selector: generateSelector(el, doc) });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.length > 0 && candidates[0].score > 5 ? candidates[0] : null;
  }

  /**
   * Search for stop/generate buttons.
   */
  function detectStopButton(doc) {
    const candidates = [];
    const elements = doc.querySelectorAll('button, [role="button"]');

    for (const el of elements) {
      let score = 0;
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const text = (el.textContent || "").trim().toLowerCase();

      if (/stop|halt|cancel/i.test(aria)) score += 15;
      if (/^(stop|halt|cancel)$/i.test(text)) score += 12;

      candidates.push({ el, score, selector: generateSelector(el, doc) });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.length > 0 && candidates[0].score > 5 ? candidates[0] : null;
  }

  /**
   * Search for message turn containers.
   */
  function detectMessageTurn(doc) {
    const candidates = [];
    const elements = doc.querySelectorAll(
      '[role="article"], [data-message-author-role], .message, .chat-message, .prose, .markdown'
    );

    for (const el of elements) {
      let score = 0;
      if (el.getAttribute("data-message-author-role")) score += 15;
      if (el.getAttribute("role") === "article") score += 12;
      if (/\b(message|chat-item|turn)\b/i.test(el.className || "")) score += 8;

      candidates.push({ el, score, selector: generateSelector(el, doc) });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.length > 0 ? candidates[0] : null;
  }

  /**
   * Run complete discovery analysis on a document.
   * Returns a ready-to-validate CustomProviderConfig.
   */
  function discover(doc, url) {
    const pageUrl = url || (doc.location && doc.location.href) || "";
    let hostname = "Custom AI";
    try {
      hostname = new URL(pageUrl).hostname.replace(/^www\./, "");
    } catch {}

    const editorMatch = detectEditor(doc);
    const sendMatch = detectSendButton(doc, editorMatch ? editorMatch.el : null);
    const stopMatch = detectStopButton(doc);
    const turnMatch = detectMessageTurn(doc);

    const pattern = pageUrl ? pageUrl.split("?")[0].replace(/\/+$/, "") + "/*" : "*://*/*";

    return {
      id: "custom_" + Date.now().toString(36),
      name: hostname,
      urlPattern: pattern,
      enabled: true,
      selectors: {
        editor: editorMatch ? editorMatch.selector : "textarea",
        sendBtn: sendMatch ? sendMatch.selector : 'button[type="submit"]',
        stopBtn: stopMatch ? stopMatch.selector : 'button[aria-label*="Stop"]',
        chatItem: turnMatch ? turnMatch.selector : ".message",
        box: ".markdown, .prose",
        codeBlock: "pre, code",
      },
      confidence: {
        editor: editorMatch ? editorMatch.score : 0,
        sendBtn: sendMatch ? sendMatch.score : 0,
        chatItem: turnMatch ? turnMatch.score : 0,
      },
    };
  }

  /**
   * Diagnostic validation of a given config against a document.
   */
  function validateConfig(doc, config) {
    if (!doc || !config || !config.selectors) {
      return { ok: false, error: "Invalid parameters" };
    }

    const checks = {
      editorFound: false,
      sendBtnFound: false,
      stopBtnFound: false,
      chatItemFound: false,
    };

    try {
      if (config.selectors.editor) {
        checks.editorFound = doc.querySelectorAll(config.selectors.editor).length > 0;
      }
      if (config.selectors.sendBtn) {
        checks.sendBtnFound = doc.querySelectorAll(config.selectors.sendBtn).length > 0;
      }
      if (config.selectors.stopBtn) {
        checks.stopBtnFound = doc.querySelectorAll(config.selectors.stopBtn).length > 0;
      }
      if (config.selectors.chatItem) {
        checks.chatItemFound = doc.querySelectorAll(config.selectors.chatItem).length > 0;
      }
    } catch (e) {
      return { ok: false, error: `Selector syntax error: ${e.message}`, checks };
    }

    const score = (checks.editorFound ? 2 : 0) + (checks.sendBtnFound ? 2 : 0) + (checks.chatItemFound ? 1 : 0);
    const passed = checks.editorFound; // Input is mandatory to drive an AI site

    return {
      ok: passed,
      score,
      maxScore: 5,
      checks,
    };
  }

  return {
    generateSelector,
    detectEditor,
    detectSendButton,
    detectStopButton,
    detectMessageTurn,
    discover,
    validateConfig,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = ZSDetector;
}

