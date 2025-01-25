document.addEventListener('DOMContentLoaded', function() {
    // Authentication elements
    const authOverlay = document.getElementById('authOverlay');
    const authForm = document.getElementById('authForm');
    const authToggle = document.getElementById('authToggle');
    const authSubmit = document.getElementById('authSubmit');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const authError = document.getElementById('authError');

    let isSignIn = true;
    let currentUser = null;

    // Check if user is already logged in
    chrome.storage.local.get(['currentUser'], function(result) {
        if (result.currentUser) {
            currentUser = result.currentUser;
            hideAuthOverlay();
        }
    });

    // Toggle between sign in and sign up
    authToggle.addEventListener('click', () => {
        isSignIn = !isSignIn;
        authSubmit.textContent = isSignIn ? 'Sign In' : 'Sign Up';
        authToggle.textContent = isSignIn ? 'Sign Up' : 'Sign In';
        const switchText = authToggle.previousElementSibling;
        switchText.textContent = isSignIn ? "Don't have an account? " : 'Already have an account? ';
        hideAuthError();
    });

    // Handle form submission
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        // Basic validation
        if (!email || !password) {
            showAuthError('Please fill in all fields');
            return;
        }

        if (password.length < 6) {
            showAuthError('Password must be at least 6 characters');
            return;
        }

        try {
            if (isSignIn) {
                // Sign In
                const users = await getUsers();
                const user = users[email];
                
                if (!user) {
                    showAuthError('Email not found');
                    return;
                }

                if (user.password !== password) {
                    showAuthError('Incorrect password');
                    return;
                }

                currentUser = { email };
                await chrome.storage.local.set({ currentUser });
                hideAuthOverlay();
            } else {
                // Sign Up
                const users = await getUsers();
                
                if (users[email]) {
                    showAuthError('Email already exists');
                    return;
                }

                users[email] = { password };
                await chrome.storage.local.set({ users });
                
                currentUser = { email };
                await chrome.storage.local.set({ currentUser });
                hideAuthOverlay();
            }
        } catch (error) {
            showAuthError('An error occurred. Please try again.');
        }
    });

    // Helper functions
    async function getUsers() {
        const result = await chrome.storage.local.get(['users']);
        return result.users || {};
    }

    function showAuthError(message) {
        authError.textContent = message;
        authError.style.display = 'block';
        emailInput.classList.add('error');
        passwordInput.classList.add('error');
    }

    function hideAuthError() {
        authError.style.display = 'none';
        emailInput.classList.remove('error');
        passwordInput.classList.remove('error');
    }

    function hideAuthOverlay() {
        authOverlay.style.display = 'none';
    }

    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const typingIndicator = document.getElementById('typingIndicator');
    const historyButton = document.getElementById('historyButton');
    const historyMenu = document.getElementById('historyMenu');
    const historyItems = document.getElementById('historyItems');
    const clearHistoryButton = document.getElementById('clearHistory');
    const newChatButton = document.getElementById('newChat');

    let currentChatId = generateChatId();
    let isHistoryMenuOpen = false;

    // Generate a unique ID for each chat session
    function generateChatId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Load current chat session when extension opens
    async function loadCurrentSession() {
        if (!currentUser) return;
        
        const userChatsKey = `chats_${currentUser.email}`;
        const currentChatKey = `current_chat_${currentUser.email}`;
        
        const storage = await chrome.storage.local.get([userChatsKey, currentChatKey]);
        const chats = storage[userChatsKey] || {};
        const savedChatId = storage[currentChatKey];
        
        if (savedChatId && chats[savedChatId]) {
            currentChatId = savedChatId;
            const chat = chats[savedChatId];
            
            // Restore chat messages
            chatContainer.innerHTML = '';
            chatContainer.appendChild(typingIndicator);
            
            for (const message of chat.messages) {
                addMessage(message.content, message.isUser);
            }
        } else {
            // Only show greeting for new chat sessions
            setTimeout(() => {
                typeMessage('Hello! I can help you understand this page better. Ask me to summarize the content or find specific information.');
            }, 500);
        }
    }

    // Save current chat ID when it changes
    async function saveCurrentChatId() {
        if (!currentUser) return;
        
        const currentChatKey = `current_chat_${currentUser.email}`;
        await chrome.storage.local.set({ [currentChatKey]: currentChatId });
    }

    // Check if user is already logged in
    chrome.storage.local.get(['currentUser'], async function(result) {
        if (result.currentUser) {
            currentUser = result.currentUser;
            hideAuthOverlay();
            await loadCurrentSession();
        }
    });

    // Load and display chat history
    async function loadChatHistory() {
        if (!currentUser) return;
        
        const userChatsKey = `chats_${currentUser.email}`;
        const storage = await chrome.storage.local.get(userChatsKey);
        const chats = storage[userChatsKey] || {};
        
        historyItems.innerHTML = '';
        
        if (Object.keys(chats).length === 0) {
            historyItems.innerHTML = `
                <div class="empty-history">
                    <div class="empty-history-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </div>
                    No chat history yet
                </div>`;
            return;
        }

        // Sort chats by timestamp (newest first)
        const sortedChats = Object.entries(chats)
            .sort(([,a], [,b]) => b.timestamp - a.timestamp);

        for (const [chatId, chat] of sortedChats) {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const itemContent = document.createElement('div');
            itemContent.className = 'history-item-content';
            
            const lastMessage = chat.messages[chat.messages.length - 1];
            const preview = lastMessage ? lastMessage.content.substring(0, 50) + '...' : 'Empty chat';
            
            itemContent.innerHTML = `
                <div class="history-item-time">${new Date(chat.timestamp).toLocaleString()}</div>
                <div class="history-item-preview">${preview}</div>
            `;
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-chat';
            deleteButton.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            `;
            
            itemContent.addEventListener('click', () => loadChat(chatId));
            deleteButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                await deleteChat(chatId);
            });
            
            historyItem.appendChild(itemContent);
            historyItem.appendChild(deleteButton);
            historyItems.appendChild(historyItem);
        }
    }

    // Delete a specific chat
    async function deleteChat(chatId) {
        if (!currentUser) return;
        
        const userChatsKey = `chats_${currentUser.email}`;
        const storage = await chrome.storage.local.get(userChatsKey);
        const chats = storage[userChatsKey] || {};
        
        if (chatId === currentChatId) {
            startNewChat();
        }
        
        delete chats[chatId];
        await chrome.storage.local.set({ [userChatsKey]: chats });
        loadChatHistory();
    }

    // Load a specific chat
    async function loadChat(chatId) {
        if (!currentUser) return;
        
        const userChatsKey = `chats_${currentUser.email}`;
        const storage = await chrome.storage.local.get(userChatsKey);
        const chats = storage[userChatsKey] || {};
        const chat = chats[chatId];
        
        if (chat) {
            chatContainer.innerHTML = '';
            chatContainer.appendChild(typingIndicator);
            
            for (const message of chat.messages) {
                addMessage(message.content, message.isUser);
            }
            
            currentChatId = chatId;
            await saveCurrentChatId();
            toggleHistoryMenu();
        }
    }

    // Save current chat
    async function saveChat(messages) {
        if (!currentUser) return;
        
        const userChatsKey = `chats_${currentUser.email}`;
        const storage = await chrome.storage.local.get(userChatsKey);
        const chats = storage[userChatsKey] || {};
        const tab = await getCurrentTab();
        
        chats[currentChatId] = {
            url: tab.url,
            messages: messages,
            timestamp: Date.now()
        };
        
        await chrome.storage.local.set({ [userChatsKey]: chats });
        await saveCurrentChatId();
        loadChatHistory();
    }

    // Clear all chat history
    async function clearHistory() {
        if (!currentUser) return;
        
        const userChatsKey = `chats_${currentUser.email}`;
        await chrome.storage.local.set({ [userChatsKey]: {} });
        loadChatHistory();
        
        chatContainer.innerHTML = '';
        chatContainer.appendChild(typingIndicator);
        currentChatId = generateChatId();
        
        setTimeout(() => {
            typeMessage('Hello! I can help you understand this page better. Ask me to summarize the content or find specific information.');
        }, 500);
    }

    // Toggle history menu
    function toggleHistoryMenu() {
        isHistoryMenuOpen = !isHistoryMenuOpen;
        historyMenu.classList.toggle('show');
        if (isHistoryMenuOpen) {
            loadChatHistory();
        }
    }

    // Start a new chat
    async function startNewChat() {
        // Clear current chat
        chatContainer.innerHTML = '';
        chatContainer.appendChild(typingIndicator);
        
        // Generate new chat ID and save it
        currentChatId = generateChatId();
        await saveCurrentChatId();
        
        // Add initial greeting
        setTimeout(() => {
            typeMessage('Hello! I can help you understand this page better. Ask me to summarize the content or find specific information.');
        }, 500);
        
        // Close history menu
        if (isHistoryMenuOpen) {
            toggleHistoryMenu();
        }
    }

    // Event listeners for history
    historyButton.addEventListener('click', toggleHistoryMenu);
    clearHistoryButton.addEventListener('click', clearHistory);
    newChatButton.addEventListener('click', startNewChat);

    // Close history menu when clicking outside
    document.addEventListener('click', (e) => {
        if (isHistoryMenuOpen && 
            !historyMenu.contains(e.target) && 
            !historyButton.contains(e.target)) {
            toggleHistoryMenu();
        }
    });

    async function getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    function showTypingIndicator() {
        typingIndicator.style.display = 'block';
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function hideTypingIndicator() {
        typingIndicator.style.display = 'none';
    }

    function parseMarkdown(text) {
        return text
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Code blocks
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Lists
            .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    }

    function addMessage(content, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : ''}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        if (!isUser) {
            messageContent.innerHTML = parseMarkdown(content);
        } else {
            messageContent.textContent = content;
        }
        
        messageDiv.appendChild(messageContent);
        chatContainer.insertBefore(messageDiv, typingIndicator);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    async function typeMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageDiv.appendChild(messageContent);
        
        chatContainer.insertBefore(messageDiv, typingIndicator);
        
        const words = message.split(' ');
        let currentText = '';
        
        for (let word of words) {
            currentText += (currentText ? ' ' : '') + word;
            messageContent.innerHTML = parseMarkdown(currentText);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    async function getPageContent() {
        const tab = await getCurrentTab();
        return new Promise((resolve) => {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    return document.body.innerText;
                }
            }, (results) => {
                resolve(results[0].result);
            });
        });
    }

    async function scrollToContent(searchText) {
        const tab = await getCurrentTab();
        try {
            // Inject a more robust scrolling function into the page
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: (text) => {
                    // Helper function to get text similarity score
                    function similarityScore(str1, str2) {
                        str1 = str1.toLowerCase().trim();
                        str2 = str2.toLowerCase().trim();
                        
                        // Exact match gets highest score
                        if (str1 === str2) return 1000;
                        if (str1.includes(str2) || str2.includes(str1)) return 800;
                        
                        // Calculate word match score
                        const words1 = str1.split(/\s+/);
                        const words2 = str2.split(/\s+/);
                        const commonWords = words1.filter(w => words2.includes(w));
                        return (commonWords.length / Math.max(words1.length, words2.length)) * 600;
                    }

                    // Helper function to check if element is visible
                    function isVisible(element) {
                        if (!element) return false;
                        
                        const style = window.getComputedStyle(element);
                        if (style.display === 'none' || 
                            style.visibility === 'hidden' || 
                            style.opacity === '0' || 
                            element.offsetParent === null) {
                            return false;
                        }

                        const rect = element.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0;
                    }

                    // Helper function to get all text-containing elements
                    function getTextElements() {
                        const elements = [];
                        const walker = document.createTreeWalker(
                            document.body,
                            NodeFilter.SHOW_TEXT,
                            null,
                            false
                        );

                        let node;
                        while (node = walker.nextNode()) {
                            const element = node.parentElement;
                            if (element && 
                                isVisible(element) && 
                                !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) {
                                elements.push({
                                    element: element,
                                    text: element.textContent.trim(),
                                    node: node
                                });
                            }
                        }
                        return elements;
                    }

                    // Find best matching element
                    function findBestMatch(searchText) {
                        const elements = getTextElements();
                        let bestMatch = null;
                        let bestScore = -1;

                        elements.forEach(({element, text, node}) => {
                            // Skip empty text or very long text blocks
                            if (!text || text.length > 1000) return;
                            
                            const score = similarityScore(text, searchText);
                            if (score > bestScore) {
                                bestScore = score;
                                bestMatch = {element, node, score};
                            }
                        });

                        return bestMatch;
                    }

                    // Scroll to element with highlighting
                    function scrollToElement(element) {
                        if (!element) return false;

                        // Try different scroll methods
                        const scrollMethods = [
                            // Method 1: scrollIntoView
                            () => {
                                element.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center'
                                });
                            },
                            // Method 2: window.scrollTo with offset
                            () => {
                                const rect = element.getBoundingClientRect();
                                const scrollTop = window.pageYOffset + rect.top - (window.innerHeight / 2);
                                window.scrollTo({
                                    top: scrollTop,
                                    behavior: 'smooth'
                                });
                            },
                            // Method 3: Direct scroll
                            () => {
                                const rect = element.getBoundingClientRect();
                                window.scrollTo(0, window.pageYOffset + rect.top - 100);
                            }
                        ];

                        // Try each scroll method
                        for (const method of scrollMethods) {
                            try {
                                method();
                                break;
                            } catch (e) {
                                continue;
                            }
                        }

                        // Add highlight effect
                        const originalBackground = element.style.backgroundColor;
                        const originalTransition = element.style.transition;
                        
                        element.style.transition = 'background-color 0.3s ease-in-out';
                        element.style.backgroundColor = '#b87aff80';
                        
                        // Pulse animation
                        setTimeout(() => {
                            element.style.backgroundColor = 'transparent';
                            setTimeout(() => {
                                element.style.backgroundColor = '#b87aff80';
                                setTimeout(() => {
                                    element.style.backgroundColor = originalBackground;
                                    element.style.transition = originalTransition;
                                }, 500);
                            }, 200);
                        }, 200);

                        return true;
                    }

                    // Main execution
                    const bestMatch = findBestMatch(text);
                    if (bestMatch && bestMatch.score > 100) {
                        return scrollToElement(bestMatch.element);
                    }

                    // Fallback: try window.find() as last resort
                    return window.find(text);
                },
                args: [searchText]
            });
        } catch (error) {
            console.error('Error in scrollToContent:', error);
            // Final fallback
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: (text) => window.find(text),
                args: [searchText]
            });
        }
    }

    // Remove the old API key and replace with these encoded parts
    const encodedParts = [
        'c2stcHJvai10aTBtRU5uVy1QSVhReWdn',
        'VkVJRHFwa2ZLQWhaYTNfUzBUZnpESDVwWGFyT1BGUC04cjM1TFJpT1lyZTFFaXNSMmxG',
        'TnFsbUdVdlQzQmxia0ZKQWZaVk9jYU1USDMtQktrZGpiYkdMUFVYSnRnTUs1cEZjVVFs',
        'UFdsSmJIMTIxU3ZpMlhVdWExQTIyazAxazhFTW9QWnV2eU02NEE='
    ];

    // Function to decode the API key at runtime
    function getApiKey() {
        try {
            // Add some simple obfuscation by combining parts and decoding
            const combined = encodedParts.join('');
            return atob(combined);
        } catch (error) {
            console.error('Error decoding API key:', error);
            return null;
        }
    }

    // Update the sendToChatGPT function to handle rate limits and errors better
    async function sendToChatGPT(messages) {
        try {
            const apiKey = getApiKey();
            if (!apiKey) {
                throw new Error('Failed to initialize API key');
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini-2024-07-18',
                    messages: messages,
                    max_tokens: 500
                })
            });

            // Handle rate limiting
            if (response.status === 429) {
                return 'I am receiving too many requests right now. Please try again in a moment.';
            }

            // Handle other error status codes
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();
            
            // Add null checks for the response data
            if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Invalid response format from API');
            }

            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error:', error);
            return 'Sorry, there was an error processing your request. Please try again.';
        }
    }

    // Update the handleMessage function to handle errors better
    async function handleMessage() {
        const userMessage = messageInput.value.trim();
        if (!userMessage) return;

        try {
            messageInput.value = '';
            messageInput.disabled = true;
            sendButton.disabled = true;

            addMessage(userMessage, true);
            showTypingIndicator();

            const pageContent = await getPageContent();
            if (!pageContent) {
                throw new Error('Failed to get page content');
            }

            const messages = [
                {
                    role: 'system',
                    content: `You are a very helpful and intelligent AI assistant that helps users understand web pages and navigate to specific content. Your name is Clarify. When users ask to find or navigate to specific content, always include your response with "NAVIGATE: " followed by the exact text to find in quotes. For example: "I found that section. NAVIGATE: "exact text to scroll to"". You can also use "SCROLL TO: ", "FIND: ", or "GO TO: " for navigation commands.`
                },
                {
                    role: 'user',
                    content: `Page content: ${pageContent}\n\nUser question: ${userMessage}`
                }
            ];

            const aiResponse = await sendToChatGPT(messages);
            hideTypingIndicator();
            
            if (aiResponse && aiResponse.trim()) {
                // Extract navigation command and clean the response
                const navigationTriggers = [
                    'NAVIGATE:', 
                    'SCROLL TO:', 
                    'FIND:', 
                    'GO TO:'
                ];
                
                let cleanResponse = aiResponse;
                let navigationText = null;

                // Look for navigation commands and extract the text to scroll to
                for (const trigger of navigationTriggers) {
                    const triggerIndex = aiResponse.toUpperCase().indexOf(trigger);
                    if (triggerIndex !== -1) {
                        // Find the quoted text after the trigger
                        const match = aiResponse.slice(triggerIndex).match(/"([^"]+)"/);
                        if (match) {
                            navigationText = match[1].trim();
                            // Remove the navigation command and quoted text from the response
                            cleanResponse = aiResponse.slice(0, triggerIndex).trim();
                            break;
                        }
                    }
                }

                await typeMessage(cleanResponse);

                if (navigationText) {
                    setTimeout(() => {
                        scrollToContent(navigationText);
                    }, 500);
                }

                // Save chat history
                const currentChat = {
                    messages: [
                        { content: userMessage, isUser: true },
                        { content: cleanResponse, isUser: false }
                    ]
                };
                
                await saveChat(currentChat.messages);
            }
        } catch (error) {
            console.error('Error in handleMessage:', error);
            hideTypingIndicator();
            await typeMessage('Sorry, there was an error processing your request. Please try again.');
        } finally {
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
        }
    }

    // Auto-resize textarea
    function autoResizeTextarea() {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    }

    // Event listeners
    messageInput.addEventListener('input', autoResizeTextarea);
    
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Allow new line with Shift+Enter
                return;
            } else {
                // Send message with just Enter
                e.preventDefault();
                handleMessage();
            }
        }
    });

    sendButton.addEventListener('click', handleMessage);

    // Reset textarea height when clearing input
    const originalHandleMessage = handleMessage;
    handleMessage = async function() {
        await originalHandleMessage.call(this);
        messageInput.style.height = '40px'; // Reset to minimum height after sending
    };

    const logoutButton = document.getElementById('logoutButton');

    // Handle logout
    async function handleLogout() {
        if (!currentUser) return;
        
        // Add confirmation dialog
        const confirmLogout = confirm('Are you sure you want to log out?');
        if (!confirmLogout) return;
        
        const currentChatKey = `current_chat_${currentUser.email}`;
        await chrome.storage.local.remove(['currentUser', currentChatKey]);
        currentUser = null;
        
        chatContainer.innerHTML = '';
        chatContainer.appendChild(typingIndicator);
        currentChatId = generateChatId();
        
        authForm.reset();
        authSubmit.textContent = 'Sign In';
        authToggle.textContent = 'Sign Up';
        authToggle.previousElementSibling.textContent = "Don't have an account? ";
        hideAuthError();
        
        authOverlay.style.display = 'flex';
        
        if (isHistoryMenuOpen) {
            toggleHistoryMenu();
        }
    }

    // Add logout button event listener
    logoutButton.addEventListener('click', handleLogout);
}); 