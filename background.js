// Set the side panel to open on normal extension icon click
chrome.sidePanel
  .setPanelBehavior({ 
    openPanelOnActionClick: true,  // This is the key setting
    hasAction: true
  })
  .catch((error) => console.error(error));

// Handle the click event
chrome.action.onClicked.addListener((tab) => {
  if (tab.url.startsWith('chrome://')) {
    // Cannot open side panel on chrome:// URLs
    chrome.action.setPopup({ popup: 'popup.html' });
  } else {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// Reset popup when navigating away from chrome:// URLs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && !tab.url.startsWith('chrome://')) {
    chrome.action.setPopup({ popup: '' });  // Clear popup to allow side panel
  }
}); 