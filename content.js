// This script runs in the context of web pages
// It's currently minimal as most functionality is handled in the popup
// But it can be extended for additional features like highlighting text or adding visual indicators

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageContent') {
        sendResponse({ content: document.body.innerText });
    }
}); 