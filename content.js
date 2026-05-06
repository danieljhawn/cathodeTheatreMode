(function () {
  const CONTAINER_ID = 'video-chat-resizer-container';
  const STYLE_ID = 'video-chat-resizer-style';
  const SELECTOR_ID = 'video-chat-resizer-selector';
  const DEFAULT_CHAT_PX = 520;
  const MIN_CHAT_PX = 180;
  const HANDLE_PX = 8;
  const STORAGE_KEY = 'cathode-chat-width';
  const CHAT_RE = /minnit|chatango|cbox|shoutbox|chat|discord|twitch\.tv\/embed\/[^/]+\/chat/i;
  const VIDEO_RE = /ok\.ru|vk\.com|vkcdn|youtube|youtu\.be|vimeo|rumble|odysee|twitch|player|stream|video|embed/i;

  const SITE_CONFIGS = {
    'cathodetv.com': {}
  };

  function getCurrentSiteConfig() {
    const hostname = window.location.hostname;
    return Object.keys(SITE_CONFIGS).some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  }

  function addBaseStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.video-chat-resizer-active,
      html.video-chat-resizer-active body {
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        overflow: hidden !important;
      }

      #${CONTAINER_ID} {
        position: fixed !important;
        inset: 0 !important;
        width: 100dvw !important;
        height: 100dvh !important;
        z-index: 2147483646 !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #000 !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: stretch !important;
        box-sizing: border-box !important;
      }

      #${CONTAINER_ID} > iframe {
        display: block !important;
        position: static !important;
        inset: auto !important;
        max-width: none !important;
        max-height: none !important;
        min-width: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        border: 0 !important;
        box-sizing: border-box !important;
      }

      #${CONTAINER_ID} .vcr-video {
        flex: 1 1 auto !important;
        width: auto !important;
        height: 100% !important;
      }

      #${CONTAINER_ID} .vcr-chat {
        flex: 0 0 var(--vcr-chat-width, ${DEFAULT_CHAT_PX}px) !important;
        width: var(--vcr-chat-width, ${DEFAULT_CHAT_PX}px) !important;
        height: 100% !important;
      }

      #${CONTAINER_ID} .vcr-handle {
        flex: 0 0 ${HANDLE_PX}px !important;
        width: ${HANDLE_PX}px !important;
        height: 100% !important;
        cursor: col-resize !important;
        background: rgba(255, 255, 255, 0.06) !important;
        z-index: 2 !important;
      }

      #${CONTAINER_ID} .vcr-handle:hover,
      #${CONTAINER_ID}.vcr-dragging .vcr-handle {
        background: rgba(255, 255, 255, 0.18) !important;
      }

      #${CONTAINER_ID} .vcr-drag-overlay {
        position: absolute !important;
        inset: 0 !important;
        display: none !important;
        cursor: col-resize !important;
        z-index: 3 !important;
      }

      #${CONTAINER_ID}.vcr-dragging .vcr-drag-overlay {
        display: block !important;
      }

      #${SELECTOR_ID} {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        cursor: crosshair !important;
        background: rgba(0, 0, 0, 0.16) !important;
      }

      #${SELECTOR_ID} .vcr-selector-label {
        position: fixed !important;
        left: 50% !important;
        top: 18px !important;
        transform: translateX(-50%) !important;
        max-width: min(520px, calc(100dvw - 28px)) !important;
        border-radius: 6px !important;
        padding: 10px 14px !important;
        background: rgba(18, 18, 18, 0.94) !important;
        color: #fff !important;
        font: 600 14px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        text-align: center !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.36) !important;
      }

      #${SELECTOR_ID} .vcr-selector-highlight {
        position: fixed !important;
        display: none !important;
        border: 3px solid #55d6ff !important;
        background: rgba(85, 214, 255, 0.12) !important;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.28) !important;
        pointer-events: none !important;
        box-sizing: border-box !important;
      }

      @media (max-width: 760px) {
        #${CONTAINER_ID} {
          flex-direction: column !important;
        }

        #${CONTAINER_ID} .vcr-video {
          flex: 1 1 58dvh !important;
          width: 100% !important;
          height: auto !important;
        }

        #${CONTAINER_ID} .vcr-chat {
          flex: 0 0 42dvh !important;
          width: 100% !important;
          height: auto !important;
        }

        #${CONTAINER_ID} .vcr-handle {
          display: none !important;
        }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function clampChatWidth(width, containerWidth) {
    const max = Math.max(MIN_CHAT_PX, containerWidth - MIN_CHAT_PX - HANDLE_PX);
    return Math.max(MIN_CHAT_PX, Math.min(max, Math.round(width)));
  }

  function loadChatWidth(containerWidth) {
    try {
      const saved = parseInt(localStorage.getItem(STORAGE_KEY), 10);
      if (!Number.isNaN(saved)) return clampChatWidth(saved, containerWidth);
    } catch (e) {}

    return clampChatWidth(Math.min(DEFAULT_CHAT_PX, containerWidth * 0.28), containerWidth);
  }

  function saveChatWidth(width) {
    try {
      localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
    } catch (e) {}
  }

  const movedFrameStates = [];
  const movedFrameStateByFrame = new WeakMap();

  function rememberFrameState(frame) {
    if (movedFrameStateByFrame.has(frame)) return;

    const placeholder = document.createComment('video-chat-resizer-placeholder');
    const state = {
      frame,
      placeholder,
      style: frame.getAttribute('style'),
      width: frame.getAttribute('width'),
      height: frame.getAttribute('height'),
      scrolling: frame.getAttribute('scrolling'),
      allowfullscreen: frame.getAttribute('allowfullscreen'),
      className: frame.className
    };

    if (frame.parentNode) {
      frame.parentNode.insertBefore(placeholder, frame);
    }

    movedFrameStateByFrame.set(frame, state);
    movedFrameStates.push(state);
  }

  function restoreAttribute(element, name, value) {
    if (value === null) {
      element.removeAttribute(name);
      return;
    }
    element.setAttribute(name, value);
  }

  function restoreOriginalPage() {
    if (typeof window.__videoChatResizerCleanup === 'function') {
      window.__videoChatResizerCleanup();
      window.__videoChatResizerCleanup = null;
    }

    movedFrameStates.forEach(state => {
      if (state.placeholder.parentNode) {
        state.placeholder.parentNode.insertBefore(state.frame, state.placeholder);
        state.placeholder.remove();
      }

      restoreAttribute(state.frame, 'style', state.style);
      restoreAttribute(state.frame, 'width', state.width);
      restoreAttribute(state.frame, 'height', state.height);
      restoreAttribute(state.frame, 'scrolling', state.scrolling);
      restoreAttribute(state.frame, 'allowfullscreen', state.allowfullscreen);
      state.frame.className = state.className;
      movedFrameStateByFrame.delete(state.frame);
    });
    movedFrameStates.length = 0;

    const container = document.getElementById(CONTAINER_ID);
    if (container) container.remove();

    Array.from(document.body.children).forEach(child => {
      if (!Object.prototype.hasOwnProperty.call(child.dataset, 'vcrPreviousDisplay')) return;
      child.style.display = child.dataset.vcrPreviousDisplay;
      delete child.dataset.vcrPreviousDisplay;
    });

    document.documentElement.classList.remove('video-chat-resizer-active');
  }

  function frameText(frame) {
    return [
      frame.src,
      frame.name,
      frame.id,
      frame.title,
      frame.getAttribute('aria-label'),
      frame.className
    ].filter(Boolean).join(' ');
  }

  function frameArea(frame) {
    const rect = frame.getBoundingClientRect();
    const attrWidth = parseInt(frame.getAttribute('width'), 10) || 0;
    const attrHeight = parseInt(frame.getAttribute('height'), 10) || 0;
    return Math.max(rect.width * rect.height, attrWidth * attrHeight);
  }

  function scoreFrame(frame) {
    const text = frameText(frame);
    const area = frameArea(frame);

    return {
      frame,
      area,
      chatScore: (CHAT_RE.test(text) ? 10000 : 0) + (area > 0 && area < 500000 ? 50 : 0),
      videoScore: (VIDEO_RE.test(text) ? 10000 : 0) + Math.min(area / 1000, 1000)
    };
  }

  function pickIframes() {
    const scored = Array.from(document.querySelectorAll('iframe'))
      .filter(frame => !frame.closest(`#${CONTAINER_ID}`))
      .map(scoreFrame)
      .sort((a, b) => b.area - a.area);

    if (scored.length < 2) return [null, null];

    const chat = [...scored].sort((a, b) => b.chatScore - a.chatScore)[0];
    const video = [...scored]
      .filter(item => item.frame !== chat.frame)
      .sort((a, b) => b.videoScore - a.videoScore)[0];

    if (!video || !chat) return [null, null];
    return [video.frame, chat.frame];
  }

  function waitForIframes(cb) {
    const tryPick = () => {
      const [video, chat] = pickIframes();
      if (video && chat) {
        cb(video, chat);
        return true;
      }
      return false;
    };

    if (tryPick()) return;

    const observer = new MutationObserver(() => {
      if (tryPick()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

    setTimeout(() => {
      tryPick();
      observer.disconnect();
    }, 7000);
  }

  function hidePageChrome(container) {
    Array.from(document.body.children).forEach(child => {
      if (child === container || child.id === STYLE_ID || child.id === SELECTOR_ID) return;
      child.dataset.vcrPreviousDisplay = child.style.display || '';
      child.style.setProperty('display', 'none', 'important');
    });
  }

  function visibleIframeAtPoint(x, y, excludedFrames) {
    const selector = document.getElementById(SELECTOR_ID);
    if (selector) selector.style.pointerEvents = 'none';

    const frame = document.elementsFromPoint(x, y).find(element => {
      if (element.tagName !== 'IFRAME') return false;
      if (excludedFrames.includes(element)) return false;

      const rect = element.getBoundingClientRect();
      return rect.width >= 80 && rect.height >= 80;
    });

    if (selector) selector.style.pointerEvents = 'auto';
    return frame || null;
  }

  function setHighlight(highlight, frame) {
    if (!frame) {
      highlight.style.display = 'none';
      return;
    }

    const rect = frame.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.left = `${rect.left}px`;
    highlight.style.top = `${rect.top}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
  }

  function selectIframe(message, excludedFrames) {
    return new Promise(resolve => {
      const existingSelector = document.getElementById(SELECTOR_ID);
      if (existingSelector) existingSelector.remove();

      const selector = document.createElement('div');
      selector.id = SELECTOR_ID;

      const label = document.createElement('div');
      label.className = 'vcr-selector-label';
      label.textContent = `${message} Press Esc to cancel.`;

      const highlight = document.createElement('div');
      highlight.className = 'vcr-selector-highlight';

      selector.append(label, highlight);
      document.documentElement.appendChild(selector);

      let currentFrame = null;

      function cleanup(frame) {
        selector.removeEventListener('pointermove', handlePointerMove);
        selector.removeEventListener('click', handleClick);
        window.removeEventListener('keydown', handleKeyDown);
        selector.remove();
        resolve(frame);
      }

      function handlePointerMove(event) {
        currentFrame = visibleIframeAtPoint(event.clientX, event.clientY, excludedFrames);
        setHighlight(highlight, currentFrame);
      }

      function handleClick(event) {
        event.preventDefault();
        event.stopPropagation();
        currentFrame = visibleIframeAtPoint(event.clientX, event.clientY, excludedFrames);
        if (currentFrame) cleanup(currentFrame);
      }

      function handleKeyDown(event) {
        if (event.key === 'Escape') cleanup(null);
      }

      selector.addEventListener('pointermove', handlePointerMove);
      selector.addEventListener('click', handleClick);
      window.addEventListener('keydown', handleKeyDown);
    });
  }

  async function startManualFrameSelection() {
    restoreOriginalPage();

    const video = await selectIframe('Select the video frame.', []);
    if (!video) return;

    const chat = await selectIframe('Select the chat frame.', [video]);
    if (!chat) return;

    buildLayout(video, chat);
  }

  function buildLayout(video, chat) {
    let container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      document.body.appendChild(container);
    }

    if (typeof window.__videoChatResizerCleanup === 'function') {
      window.__videoChatResizerCleanup();
      window.__videoChatResizerCleanup = null;
    }

    hidePageChrome(container);
    document.documentElement.classList.add('video-chat-resizer-active');

    const handle = document.createElement('div');
    handle.className = 'vcr-handle';

    const overlay = document.createElement('div');
    overlay.className = 'vcr-drag-overlay';

    [video, chat].forEach(frame => {
      rememberFrameState(frame);
      frame.removeAttribute('width');
      frame.removeAttribute('height');
      frame.removeAttribute('style');
      frame.removeAttribute('scrolling');
      frame.setAttribute('allowfullscreen', 'true');
    });

    video.classList.add('vcr-video');
    chat.classList.add('vcr-chat');

    container.replaceChildren(video, handle, chat, overlay);

    let chatWidth = loadChatWidth(container.getBoundingClientRect().width || window.innerWidth);
    container.style.setProperty('--vcr-chat-width', `${chatWidth}px`);

    function setChatWidth(width) {
      chatWidth = clampChatWidth(width, container.getBoundingClientRect().width || window.innerWidth);
      container.style.setProperty('--vcr-chat-width', `${chatWidth}px`);
    }

    function stopDragging() {
      if (!container.classList.contains('vcr-dragging')) return;
      container.classList.remove('vcr-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      saveChatWidth(chatWidth);
    }

    function handlePointerMove(event) {
      if (!container.classList.contains('vcr-dragging')) return;
      const rect = container.getBoundingClientRect();
      setChatWidth(rect.right - event.clientX - HANDLE_PX / 2);
    }

    handle.addEventListener('pointerdown', event => {
      if (window.matchMedia('(max-width: 760px)').matches) return;
      event.preventDefault();
      container.classList.add('vcr-dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      handle.setPointerCapture(event.pointerId);
    });

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('blur', stopDragging);
    window.addEventListener('resize', handleResize);

    function handleResize() {
      setChatWidth(chatWidth);
    }

    window.__videoChatResizerCleanup = () => {
      stopDragging();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('blur', stopDragging);
      window.removeEventListener('resize', handleResize);
    };
  }

  if (!getCurrentSiteConfig()) {
    console.log('[Video Chat Resizer] Site not supported, extension will not activate');
    return;
  }

  if (window.__videoChatResizerActivated) {
    console.log('[Video Chat Resizer] Already activated, skipping');
    return;
  }
  window.__videoChatResizerActivated = true;

  addBaseStyles();
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'video-chat-resizer:start-manual-selection') {
      startManualFrameSelection();
      sendResponse({ ok: true });
    }
  });

  waitForIframes((video, chat) => {
    console.log('[Video Chat Resizer] Activating layout');
    buildLayout(video, chat);
  });
})();
