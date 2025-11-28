(function () {
  const DEFAULT_CHAT_PX = 350;
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

    // chat fixed width, responsive on small screens
    const chatWidth = Math.max(MIN_CHAT_PX, Math.min(DEFAULT_CHAT_PX, Math.round(window.innerWidth * 0.25)));
    Object.assign(chat.style, {
      flex: `0 0 ${chatWidth}px`,
      width: 'auto',
      height: '100%',
      overflow: 'auto',
      boxSizing: 'border-box',
      borderLeft: '1px solid rgba(255,255,255,0.04)',
      background: 'transparent',
    });
  }

  // run
  waitForWrapper(wrapper => {
    const node = makeFullscreen(wrapper);
    const [video, chat] = pickIframes(node);
    applyStaticLayout(node, video, chat);
  });
})();
