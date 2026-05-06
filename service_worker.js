chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'video-chat-resizer:start-manual-selection'
    });
  } catch (error) {
    console.warn('[Video Chat Resizer] Could not start manual selection on this tab:', error);
  }
});
