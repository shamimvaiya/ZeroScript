// SPDX-License-Identifier: GPL-3.0-or-later
// Google AI Studio provider adapter. Kept separate from Gemini because the two
// Google products use different application shells and composer DOMs.
// eslint-disable-next-line no-unused-vars
const ZSProvider = (() => {
  "use strict";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let lastLength = 0, lastGrowth = 0;
  const S = {
    user: '[data-message-author-role="user"], [data-author="user"], .user-message',
    assistant: '[data-message-author-role="assistant"], [data-author="assistant"], .model-response, .assistant-message',
    editor: 'textarea, [contenteditable="true"], [role="textbox"]',
    send: 'button[data-testid*="send"], button[aria-label*="Send"], button[aria-label*="send"]',
    stop: 'button[data-testid*="stop"], button[aria-label*="Stop"], button[aria-label*="stop"]',
    code: "pre, code-block, .code-block",
    error: '[role="alert"], [class*="error"], [class*="toast"]',
  };
  const timings = { GEN_IDLE_MS: 1500, REASON_IDLE_MS: 12000, WARMUP_MS: 45000, REASON_NOREPLY_MS: 90000, STABLE_MS: 9000, RESPONSE_TIMEOUT_MS: 300000 };
  const visible = (el) => !!el && el.offsetParent !== null;
  const getEditor = () => [...document.querySelectorAll(S.editor)].find((el) => visible(el) && !el.closest("#zs-root")) || null;
  const editorText = () => { const el = getEditor(); return el ? ("value" in el ? el.value : el.textContent || "") : ""; };
  const allItems = () => [...document.querySelectorAll(`${S.user}, ${S.assistant}`)].filter((el, i, list) => list.indexOf(el) === i);
  const isUserItem = (el) => !!el && el.matches(S.user);
  const isAssistantItem = (el) => !!el && el.matches(S.assistant);
  const assistantItems = () => allItems().filter(isAssistantItem);
  const assistantCount = () => assistantItems().length;
  const userCount = () => allItems().filter(isUserItem).length;
  const lastAssistant = () => assistantItems().at(-1) || null;
  const itemText = (item) => item ? (item.innerText || item.textContent || "") : "";
  const classifyText = (item, excludeSel) => {
    if (!item) return "";
    if (!excludeSel) return itemText(item);
    const clone = item.cloneNode(true);
    clone.querySelectorAll(excludeSel).forEach((el) => el.remove());
    return itemText(clone);
  };
  const readAssistant = () => { const item = lastAssistant(); return item ? { present: true, reply: classifyText(item, ".zs-chip"), thinking: "", item } : { present: false, reply: "", thinking: "", item: null }; };
  const streamLen = (item) => itemText(item || lastAssistant()).length;
  const snapshot = () => ({ th: 0, rp: streamLen() });
  function isGenerating() {
    const length = streamLen();
    const now = Date.now();
    if (length > lastLength) { lastLength = length; lastGrowth = now; }
    return [...document.querySelectorAll(S.stop)].some(visible) || (lastGrowth && now - lastGrowth < timings.GEN_IDLE_MS);
  }
  const isBusyNow = isGenerating, isHardGenerating = isGenerating;
  const waitFor = async (pred, timeout) => { const start = Date.now(); while (Date.now() - start < timeout) { if (pred()) return true; await sleep(120); } return false; };
  const sendButton = () => [...document.querySelectorAll(S.send)].find(visible) || null;
  const stopButton = () => [...document.querySelectorAll(S.stop)].find(visible) || null;
  function setEditorText(editor, text) {
    editor.focus();
    if ("value" in editor) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(editor), "value");
      if (setter && setter.set) setter.set.call(editor, text); else editor.value = text;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    const selection = window.getSelection(), range = document.createRange();
    range.selectNodeContents(editor); selection.removeAllRanges(); selection.addRange(range);
    document.execCommand("insertText", false, text);
  }
  async function typeAndSend(text) {
    const editor = getEditor();
    if (!editor) throw new Error("Google AI Studio input box not found");
    if (editorText() !== text) setEditorText(editor, text);
    await waitFor(() => !!sendButton(), 5000);
    const button = sendButton();
    if (button) button.click();
    else editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
  }
  const stopGeneration = () => { const button = stopButton(); if (button) button.click(); };
  const chatIsEmpty = () => allItems().length === 0;
  const isFreshChat = () => chatIsEmpty() && !!getEditor();
  const composerFrame = () => { const editor = getEditor(); return editor && editor.parentElement; };
  const barMount = () => { const editor = getEditor(); return editor && editor.parentElement ? { parent: editor.parentElement, before: editor } : null; };
  const setInputLock = (on) => { const editor = getEditor(); if (editor) editor.toggleAttribute("disabled", on); };
  const enforceComposer = () => ({ ready: !!getEditor() });
  const ensureComposerReady = async () => ({ ready: !!getEditor() });
  const turnHalted = () => false, findContinueBtn = () => null, clickContinueBtn = () => false;
  const scanError = () => { for (const el of document.querySelectorAll(S.error)) if (visible(el) && !el.closest(S.assistant)) return (el.innerText || "").slice(0, 240) || null; return getEditor() ? null : "The input box disappeared (session ended?)."; };
  const isTooLongMsg = (text) => /conversation|context|token.{0,10}limit/i.test(text || "");
  const isBusyMsg = (text) => /try again|temporarily unavailable|rate limit|something went wrong/i.test(text || "");
  const conversationKey = () => /\/prompts\/new_chat\/?$/.test(location.pathname) ? "" : location.pathname;
  function installSendHooks(handlers) {
    document.addEventListener("keydown", (event) => {
      const editor = getEditor();
      if (event.key !== "Enter" || event.shiftKey || !editor || !editor.contains(event.target) || !editorText().trim() || handlers.isBlocked()) return;
      if (!handlers.isStarted()) { if (chatIsEmpty()) handlers.onBlockedAttempt(); return; }
      handlers.onUserMessage(assistantCount());
    }, true);
    document.addEventListener("click", (event) => {
      if (!event.isTrusted || !getEditor()) return;
      const button = event.target.closest("button");
      if (!button || (!button.matches(S.send) && !button.matches(S.stop))) return;
      if (button.matches(S.stop)) { handlers.onNativeStop(); return; }
      if (handlers.isBlocked()) return;
      if (!handlers.isStarted()) { if (chatIsEmpty()) handlers.onBlockedAttempt(); return; }
      handlers.onUserMessage(assistantCount());
    }, true);
  }
  function findToolBlockSpot(item) {
    let found = null;
    item.querySelectorAll(S.code).forEach((block) => {
      if (/"(?:command|tool)"\s*:\s*"|###\s*lua|###mcp_tool###/i.test(block.textContent || "")) { block.classList.add("zs-tool-hide"); found = found || { parent: block.parentElement, ref: block }; }
    });
    return found;
  }
  return { id: "aistudio", displayName: "Google AI Studio", supportsVision: true, timings, chipAtItemLevel: true,
    init() {}, allItems, isUserItem, isAssistantItem, itemText, classifyText, assistantCount, userCount, lastAssistant, readAssistant, streamLen, snapshot,
    getEditor, editorText, chatIsEmpty, isFreshChat, composerFrame, barMount, setInputLock, typeAndSend, stopGeneration, isGenerating, isBusyNow, isHardGenerating,
    enforceComposer, ensureComposerReady, turnHalted, findContinueBtn, clickContinueBtn, scanError, isTooLongMsg, isBusyMsg, conversationKey, installSendHooks, findToolBlockSpot };
})();