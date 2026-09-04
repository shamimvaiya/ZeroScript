// SPDX-License-Identifier: GPL-3.0-or-later
// providers/base-provider.js - Formal specification and reference contract
// for AI Provider Adapters in ZeroScript / Universal Agent.
//
// Each AI chat website (ChatGPT, DeepSeek, Gemini, AI Studio, Kimi, GLM, Qwen,
// Arena, Meta AI, Claude, etc.) or local AI web UI must implement this interface.
// The core agent loop (core/main.js) interacts ONLY with this interface and never
// touches the target site's DOM directly.

/* eslint-disable no-unused-vars */

/**
 * @typedef {Object} ProviderSnapshot
 * @property {boolean} editorPresent - Whether the chat input element exists in the DOM.
 * @property {boolean} sendBtnPresent - Whether the submit/send button exists.
 * @property {boolean} stopBtnPresent - Whether the stop button exists.
 * @property {number} turnCount - Current number of chat turns/messages in the DOM.
 * @property {string} editorText - Current text inside the user composer.
 */

/**
 * Standard interface contract for ZSProvider.
 */
const ZSProviderContract = {
  /**
   * Initialize provider with core callbacks (e.g. diagnostic logger).
   * @param {{ diag: Function }} options
   */
  init: (options) => {},

  /**
   * Timing configurations (in milliseconds) tuned for the target site's DOM.
   */
  timings: {
    sendSettleMs: 250,
    editorPollMs: 100,
    genPollMs: 150,
  },

  /**
   * Site-specific prompt rules or guidelines (optional).
   * Injected into the system prompt turn.
   */
  promptExtra: "",

  /**
   * Capture a lightweight diagnostic snapshot of the chat UI state.
   * @returns {ProviderSnapshot}
   */
  snapshot: () => ({
    editorPresent: false,
    sendBtnPresent: false,
    stopBtnPresent: false,
    turnCount: 0,
    editorText: "",
  }),

  /**
   * Check whether the AI site is currently generating / streaming a response.
   * @returns {boolean}
   */
  isGenerating: () => false,

  /**
   * Find the main message composer input (textarea or contenteditable).
   * @returns {HTMLElement|null}
   */
  getEditor: () => null,

  /**
   * Find the primary Send / Submit button.
   * @returns {HTMLElement|null}
   */
  getSendButton: () => null,

  /**
   * Find the Stop button displayed during active streaming.
   * @returns {HTMLElement|null}
   */
  getStopButton: () => null,

  /**
   * Retrieve the DOM element of the latest assistant message turn.
   * @returns {HTMLElement|null}
   */
  getLatestAssistantTurn: () => null,

  /**
   * Extract raw text from a turn element (stripping thinking/reasoning blocks if needed).
   * @param {HTMLElement} turnEl
   * @returns {string}
   */
  extractTurnText: (turnEl) => "",

  /**
   * Inject text into the composer and trigger native input events.
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  injectMessage: async (text) => false,
};

