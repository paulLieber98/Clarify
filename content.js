// This script runs in the context of web pages
// It's currently minimal as most functionality is handled in the popup
// But it can be extended for additional features like highlighting text or adding visual indicators

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageContent') {
        sendResponse({ content: document.body.innerText });
        return true;
    }
    
    if (request.action === 'scrollToText') {
        // Execute scrolling
        const success = scrollToText(request.searchText);
        // Send response back
        sendResponse({ success: success });
        return true; // Keep the message channel open
    }
    return true; // Always return true to indicate we'll respond asynchronously
});

function scrollToText(searchText) {
    // Helper function to get all text nodes
    function getAllTextNodes() {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        const nodes = [];
        let node;
        while (node = walker.nextNode()) {
            nodes.push(node);
        }
        return nodes;
    }

    // Helper function to check if element is visible
    function isVisible(element) {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0';
    }

    // Find best matching node with more aggressive matching
    const textNodes = getAllTextNodes();
    let bestMatch = null;
    let bestMatchScore = 0;

    const searchTextLower = searchText.toLowerCase().trim();
    
    textNodes.forEach(node => {
        if (!isVisible(node.parentElement)) return;
        
        const nodeText = node.textContent.toLowerCase();
        
        // Try exact match first
        if (nodeText.includes(searchTextLower)) {
            const score = 1000 + (1000 - Math.abs(nodeText.length - searchTextLower.length));
            if (score > bestMatchScore) {
                bestMatch = node;
                bestMatchScore = score;
            }
        }
        
        // If no exact match, try fuzzy matching
        if (!bestMatch) {
            const words = searchTextLower.split(' ');
            const matchedWords = words.filter(word => nodeText.includes(word));
            const score = (matchedWords.length / words.length) * 500;
            if (score > bestMatchScore) {
                bestMatch = node;
                bestMatchScore = score;
            }
        }
    });

    if (bestMatch) {
        // Force scroll with multiple methods for better reliability
        try {
            // Highlight the found text more prominently
            const originalBackground = bestMatch.parentElement.style.backgroundColor;
            bestMatch.parentElement.style.backgroundColor = '#b87aff80'; // More visible highlight
            
            // Scroll with both methods
            bestMatch.parentElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            // Forced window scroll after a small delay
            setTimeout(() => {
                const rect = bestMatch.parentElement.getBoundingClientRect();
                window.scrollTo({
                    top: window.pageYOffset + rect.top - (window.innerHeight / 2),
                    behavior: 'smooth'
                });
                
                // Double-check scroll position after animation
                setTimeout(() => {
                    const newRect = bestMatch.parentElement.getBoundingClientRect();
                    if (Math.abs(newRect.top - (window.innerHeight / 2)) > 50) {
                        window.scrollTo({
                            top: window.pageYOffset + newRect.top - (window.innerHeight / 2),
                            behavior: 'auto' // Instant scroll if needed
                        });
                    }
                }, 500);
            }, 100);

            // Remove highlight after delay
            setTimeout(() => {
                bestMatch.parentElement.style.backgroundColor = originalBackground;
            }, 2000);

            return true;
        } catch (error) {
            console.error('Scroll error:', error);
            return false;
        }
    }
    return false;
} 