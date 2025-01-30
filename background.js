// Initialize when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log("Clarify extension installed/updated");
  // Set initial side panel behavior
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(error => console.error("Error setting panel behavior:", error));
});

// Handle clicking the extension icon
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Don't attempt to open on chrome:// URLs
    if (tab.url.startsWith('chrome://')) {
      console.warn("Cannot open side panel on chrome:// pages");
      return;
    }

    // Set options and open panel
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: 'sidepanel.html',
      enabled: true
    });

    // Force panel to open
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (error) {
    console.error("Error handling side panel:", error);
  }
});

// Enable side panel for all valid tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
    chrome.sidePanel.setOptions({
      tabId: tabId,
      path: 'sidepanel.html',
      enabled: true
    }).catch(error => console.error("Error enabling side panel:", error));
  }
});
