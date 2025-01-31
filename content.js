// This script runs in the context of web pages
// It's currently minimal as most functionality is handled in the popup
// But it can be extended for additional features like highlighting text or adding visual indicators

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageContent') {
        try {
            const content = document.body.innerText;
            sendResponse({ content });
        } catch (error) {
            sendResponse({ error: error.message });
        }
        return true;
    }
    
    if (request.action === 'scrollToText') {
        try {
            const success = findAndScrollToText(request.searchText);
            sendResponse({ success });
        } catch (error) {
            console.error('Error:', error);
            sendResponse({ success: false });
        }
        return true;
    }
    
    return false;
});

function findAndScrollToText(searchText) {
    // Clear any existing selection
    window.getSelection().removeAllRanges();
    
    // First try exact match
    let found = window.find(searchText, false, false, true, false, true, false);
    
    if (!found) {
        // Try case-insensitive search
        found = window.find(searchText, false, true, true, false, true, false);
    }
    
    if (found) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;
        
        const range = selection.getRangeAt(0);
        const element = range.commonAncestorContainer.parentElement;
        
        // Ensure element is visible
        if (!isElementVisible(element)) return false;
        
        // Save original style for highlight
        const originalBackground = element.style.backgroundColor;
        const originalTransition = element.style.transition;
        
        // Disable smooth scroll behavior
        document.documentElement.style.scrollBehavior = 'auto';
        
        // First scroll to top
        window.scrollTo(0, 0);
        
        // Wait a bit before starting the animation
        setTimeout(() => {
            const targetY = element.getBoundingClientRect().top + window.scrollY - (window.innerHeight / 2);
            const startY = 0; // Starting from top
            const distance = Math.abs(targetY - startY);
            
            // Longer duration for more visible scroll
            const duration = Math.min(3000, Math.max(1500, distance * 0.5));
            
            let startTime = null;
            
            function easeInOutQuint(t) {
                return t < 0.5 
                    ? 16 * t * t * t * t * t
                    : 1 - Math.pow(-2 * t + 2, 5) / 2;
            }
            
            function animate(currentTime) {
                if (!startTime) startTime = currentTime;
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                const easedProgress = easeInOutQuint(progress);
                const currentPosition = startY + (targetY - startY) * easedProgress;
                
                window.scrollTo(0, currentPosition);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Animation complete - apply highlight
                    element.style.transition = 'background-color 0.3s ease-in-out';
                    element.style.backgroundColor = '#b87aff80';
                    
                    // Remove highlight after delay
                    setTimeout(() => {
                        element.style.backgroundColor = originalBackground;
                        element.style.transition = originalTransition;
                        // Restore smooth scroll behavior
                        document.documentElement.style.scrollBehavior = 'smooth';
                    }, 2000);
                }
            }
            
            requestAnimationFrame(animate);
        }, 100);
        
        return true;
    }
    
    return false;
}

function calculateRelevanceScore(element, isExactMatch) {
    let score = 0;
    
    // Base score for exact matches
    score += isExactMatch ? 50 : 0;
    
    // Prioritize headings
    const tagName = element.tagName.toLowerCase();
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        score += (7 - parseInt(tagName[1])) * 10; // h1 gets more points than h6
    }
    
    // Check font size
    const fontSize = parseInt(window.getComputedStyle(element).fontSize);
    score += fontSize;
    
    // Check visibility and position
    const rect = element.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
        score += 20; // Bonus for elements in viewport
    }
    
    // Check if element is in main content area
    const isInMain = element.closest('main, article, [role="main"]');
    if (isInMain) score += 30;
    
    // Penalize elements that are likely navigation or footer
    const isInNav = element.closest('nav, header, footer, [role="navigation"]');
    if (isInNav) score -= 40;
    
    // Bonus for elements with more content
    score += Math.min(element.textContent.length / 10, 20);
    
    // Penalize very small text
    if (fontSize < 12) score -= 20;
    
    // Penalize hidden or less visible elements
    const opacity = parseFloat(window.getComputedStyle(element).opacity);
    score *= opacity;
    
    return score;
}

function isElementVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           rect.width > 0 && 
           rect.height > 0 &&
           element.offsetParent !== null &&
           !element.closest('[aria-hidden="true"]');
} 