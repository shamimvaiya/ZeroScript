// SPDX-License-Identifier: GPL-3.0-or-later
// providers/custom-runtime.js - Dynamic provider adapter for user-added AI websites.
// Implements the standard ZSProvider interface driven by user-validated selector configs.
// Pure DOM selector matching - ZERO arbitrary eval or remote code execution.

/* eslint-disable no-unused-vars */
const ZSCustomProvider = (() => {
  "use strict";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let diag = () => {};
  let currentConfig = null;

  function setConfig(cfg) {
    currentConfig = cfg;
  }

  function getConfig() {
    return currentConfig;
  }

  const S = () => (currentConfig && currentConfig.selectors) || {
    editor: 'textarea, [contenteditable="true"]',
    sendBtn: 'button[type="submit"]',
    stopBtn: 'button[aria-label*="Stop"]',
    chatItem: '.message, [role="article"]',
    box: '.markdown, .prose',
  };

  function init(opts) {
    if (opts && opts.diag) diag = opts.diag;
  }

  const timings = {
    sendSettleMs: 250,
    editorPollMs: 100,
    genPollMs: 150,
  };

  function getEditor() {
    const sel = S().editor;
    if (!sel) return null;
    return document.querySelector(sel);
  }

  function getSendButton() {
    const sel = S().sendBtn;
    if (!sel) return null;
    return document.querySelector(sel);
  }

  function getStopButton() {
    const sel = S().stopBtn;
    if (!sel) return null;
    return document.querySelector(sel);
  }

  function isGenerating() {
    const stop = getStopButton();
    if (stop && stop.offsetParent !== null && !stop.disabled) return true;
    return false;
  }

  function getLatestAssistantTurn() {
    const sel = S().chatItem;
    if (!sel) return null;
    const items = document.querySelectorAll(sel);
    if (!items.length) return null;
    return items[items.length - 1];
  }

  function extractTurnText(el) {
    if (!el) return "";
    const boxSel = S().box;
    const box = boxSel ? el.querySelector(boxSel) : null;
    const target = box || el;
    return target.innerText || target.textContent || "";
  }

  async function injectMessage(text) {
    const editor = getEditor();
    if (!editor) return false;

    if (editor.tagName.toLowerCase() === "textarea" || editor.tagName.toLowerCase() === "input") {
      editor.focus();
      editor.value = text;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (editor.getAttribute("contenteditable") === "true") {
      editor.focus();
      editor.textContent = text;
      editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }

    await sleep(timings.sendSettleMs);

    const btn = getSendButton();
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }

    // Fallback: simulate Enter keypress
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
    return true;
  }

  function snapshot() {
    const ed = getEditor();
    const send = getSendButton();
    const stop = getStopButton();
    const turns = document.querySelectorAll(S().chatItem);
    return {
      editorPresent: !!ed,
      sendBtnPresent: !!send,
      stopBtnPresent: !!stop,
      turnCount: turns.length,
      editorText: ed ? (ed.value || ed.textContent || "") : "",
    };
  }

  return {
    init,
    setConfig,
    getConfig,
    timings,
    promptExtra: "",
    snapshot,
    isGenerating,
    getEditor,
    getSendButton,
    getStopButton,
    getLatestAssistantTurn,
    extractTurnText,
    injectMessage,
  };
})();

