(function () {
  const DEFAULT_CHAT_PX = 520;
  const MIN_CHAT_PX = 150;

  function waitForWrapper(cb) {
    const w = document.querySelector('.wrapper');
    if (w) return cb(w);
    const mo = new MutationObserver(() => {
      const found = document.querySelector('.wrapper');
      if (found) {
        mo.disconnect();
        cb(found);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    // fallback after a few seconds
    setTimeout(() => {
      const f = document.querySelector('.wrapper');
      if (f) {
        try { mo.disconnect(); } catch (e) {}
        cb(f);
      }
    }, 4000);
  }

  function clamp(v) {
    return Math.max(MIN_CHAT_PX, Math.round(v));
  }

  function makeFullscreen(wrapper) {
    // climb to the topmost container inside body that contains wrapper
    let node = wrapper;
    while (node.parentElement && node.parentElement !== document.body) node = node.parentElement;

    // pin it to viewport
    Object.assign(node.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '2147483647',
      margin: '0',
      padding: '0',
      background: 'black',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'stretch',
    });

    // hide all other top-level siblings so header/footer do not interfere
    document.querySelectorAll('body > *').forEach(el => {
      if (el !== node) el.style.display = 'none';
    });

    return node;
  }

  function pickIframes(node) {
    const iframes = Array.from(node.querySelectorAll('iframe'));
    if (iframes.length >= 2) return [iframes[0], iframes[1]];
    // fallback heuristics across whole document
    const all = Array.from(document.querySelectorAll('iframe'));
    if (!all.length) return [null, null];
    const video = all.find(f => /ok\.ru|vk\.com|vkcdn|videoembed/.test(f.src)) || all[0];
    const chat = all.find(f => /minnit|chat|twitch|discordapp/.test(f.src)) || all[1] || all[0];
    return [video || null, chat || null];
  }

  function createResizeHandle() {
    const handle = document.createElement('div');
    handle.style.cssText = `
      width: 8px;
      height: 100%;
      cursor: col-resize;
      background: rgba(255, 255, 255, 0.05);
      transition: background 0.2s;
      flex-shrink: 0;
      position: relative;
      z-index: 10;
    `;

    handle.addEventListener('mouseenter', () => {
      handle.style.background = 'rgba(255, 255, 255, 0.15)';
    });

    handle.addEventListener('mouseleave', () => {
      handle.style.background = 'rgba(255, 255, 255, 0.05)';
    });

    return handle;
  }

  function loadChatWidth() {
    try {
      const saved = localStorage.getItem('cathode-chat-width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) return clamp(parsed);
      }
    } catch (e) {}
    return Math.max(MIN_CHAT_PX, Math.min(DEFAULT_CHAT_PX, Math.round(window.innerWidth * 0.25)));
  }

  function saveChatWidth(width) {
    try {
      localStorage.setItem('cathode-chat-width', String(width));
    } catch (e) {}
  }

  function applyStaticLayout(node, video, chat) {
    if (!video || !chat) {
      console.warn('Cathode fix: could not locate video and/or chat iframes');
      return;
    }

    // normalize iframes to play nicely with flex
    [video, chat].forEach(f => {
      try { f.removeAttribute('width'); f.removeAttribute('height'); } catch (e) {}
      Object.assign(f.style, {
        position: 'static',
        border: 'none',
        minWidth: '0',
        minHeight: '0',
        height: '100%',
      });
    });

    // video fills remaining space
    Object.assign(video.style, {
      flex: '1 1 auto',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
    });

    // load saved or default chat width
    let chatWidth = loadChatWidth();

    // chat fixed width, responsive on small screens
    Object.assign(chat.style, {
      flex: `0 0 ${chatWidth}px`,
      width: 'auto',
      height: '100%',
      overflow: 'auto',
      boxSizing: 'border-box',
      background: 'transparent',
    });

    // create and insert resize handle before chat
    const handle = createResizeHandle();
    chat.parentNode.insertBefore(handle, chat);

    // create overlay to block iframe mouse events during drag
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 9999;
      cursor: col-resize;
      display: none;
      pointer-events: auto;
    `;
    node.appendChild(overlay);

    // drag logic
    let isDragging = false;

    const stopDragging = () => {
      if (isDragging) {
        isDragging = false;
        overlay.style.display = 'none';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        handle.style.background = 'rgba(255, 255, 255, 0.05)';
        saveChatWidth(chatWidth);
      }
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const containerRect = node.getBoundingClientRect();
      const maxChatWidth = containerRect.width - MIN_CHAT_PX; // leave at least MIN_CHAT_PX for video
      const newChatWidth = containerRect.right - e.clientX - 4; // account for handle width
      const clampedWidth = Math.max(MIN_CHAT_PX, Math.min(maxChatWidth, newChatWidth));

      chatWidth = clampedWidth;
      chat.style.flex = `0 0 ${clampedWidth}px`;
      video.style.flex = '1 1 auto';
    };

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      e.preventDefault();
      e.stopPropagation();
      overlay.style.display = 'block';
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      handle.style.background = 'rgba(255, 255, 255, 0.15)';
    });

    overlay.addEventListener('mousemove', handleMouseMove);
    overlay.addEventListener('mouseup', stopDragging);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('mouseleave', stopDragging);

    // also stop dragging if user leaves the window
    window.addEventListener('blur', stopDragging);
  }

  // run
  waitForWrapper(wrapper => {
    const node = makeFullscreen(wrapper);
    const [video, chat] = pickIframes(node);
    applyStaticLayout(node, video, chat);
  });
})();
