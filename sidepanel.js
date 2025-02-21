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

    // Check if user is already logged in using sync storage
    async function checkCurrentUser() {
        const user = await UserSync.getCurrentUser();
        if (user) {
            currentUser = user;
            hideAuthOverlay();
            await loadCurrentSession();
        }
    }
    checkCurrentUser();

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
            const users = await UserSync.getUsers();

            if (isSignIn) {
                // Sign In
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
                await UserSync.setCurrentUser(currentUser);
                hideAuthOverlay();
                await loadCurrentSession();
            } else {
                // Sign Up
                if (users[email]) {
                    showAuthError('Email already exists');
                    return;
                }

                // Save new user
                await UserSync.saveUser(email, { 
                    password,
                    created: new Date().toISOString()
                });
                
                currentUser = { email };
                await UserSync.setCurrentUser(currentUser);
                hideAuthOverlay();
                await loadCurrentSession();
            }
        } catch (error) {
            console.error('Auth error:', error);
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

    let currentChatId = null;
    let isHistoryMenuOpen = false;

    // Generate a unique ID for each chat session
    function generateChatId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Load current chat session when extension opens
    async function loadCurrentSession() {
        if (!currentUser) return;
        
        try {
            // Get the last active chat ID
            const savedChatId = await UserSync.getCurrentChatId(currentUser.email);
            const chats = await UserSync.getUserChats(currentUser.email);
            
            if (savedChatId && chats[savedChatId]) {
                currentChatId = savedChatId;
                const chat = chats[savedChatId];
                
                // Restore chat messages
                chatContainer.innerHTML = '';
                chatContainer.appendChild(typingIndicator);
                
                // Make sure we have messages array
                if (chat.messages && Array.isArray(chat.messages)) {
                    for (const message of chat.messages) {
                        addMessage(message.content, message.isUser);
                    }
                }
            } else {
                // Start a new chat if no saved chat exists
                await startNewChat();
            }
        } catch (error) {
            console.error('Error loading session:', error);
            await startNewChat();
        }
    }

    // Save current chat ID when it changes
    async function saveCurrentChatId() {
        if (!currentUser) return;
        await UserSync.saveCurrentChatId(currentUser.email, currentChatId);
    }

    // Load and display chat history
    async function loadChatHistory() {
        if (!currentUser) return;
        
        try {
            const chats = await UserSync.getUserChats(currentUser.email);
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
                .sort(([,a], [,b]) => new Date(b.timestamp) - new Date(a.timestamp));

            for (const [chatId, chat] of sortedChats) {
                const historyItem = document.createElement('div');
                historyItem.className = `history-item${chatId === currentChatId ? ' active' : ''}`;
                
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
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    // Delete a specific chat
    async function deleteChat(chatId) {
        if (!currentUser) return;
        
        try {
            await UserSync.deleteUserChat(currentUser.email, chatId);
            
            if (chatId === currentChatId) {
                await startNewChat();
            }
            
            await loadChatHistory();
        } catch (error) {
            console.error('Error deleting chat:', error);
        }
    }

    // Load a specific chat
    async function loadChat(chatId) {
        if (!currentUser) return;
        
        try {
            const chats = await UserSync.getUserChats(currentUser.email);
            const chat = chats[chatId];
            
            if (chat) {
                currentChatId = chatId;
                await saveCurrentChatId();
                
                chatContainer.innerHTML = '';
                chatContainer.appendChild(typingIndicator);
                
                for (const message of chat.messages) {
                    addMessage(message.content, message.isUser);
                }
                
                toggleHistoryMenu();
            }
        } catch (error) {
            console.error('Error loading chat:', error);
        }
    }

    // Save current chat
    async function saveChat(newMessages) {
        if (!currentUser) return;
        
        try {
            // Get existing chat history
            const chats = await UserSync.getUserChats(currentUser.email);
            let existingChat = chats[currentChatId];
            
            if (!existingChat) {
                // Initialize new chat
                existingChat = {
                    messages: [],
                    timestamp: new Date().toISOString()
                };
            }
            
            // Ensure messages array exists
            if (!Array.isArray(existingChat.messages)) {
                console.log('Fixing corrupted messages array');
                existingChat.messages = [];
            }
            
            // Add new messages
            for (const msg of newMessages) {
                if (!existingChat.messages.some(m => 
                    m.content === msg.content && 
                    m.isUser === msg.isUser
                )) {
                    existingChat.messages.push(msg);
                }
            }
            
            // Update timestamp
            existingChat.timestamp = new Date().toISOString();
            
            // Debug log
            console.log('Saving chat with messages:', existingChat.messages.length);
            
            // Save the updated chat
            await UserSync.saveUserChat(currentUser.email, currentChatId, existingChat);
            await loadChatHistory(); // Refresh the history menu
        } catch (error) {
            console.error('Error saving chat:', error);
        }
    }

    // Clear all chat history
    async function clearHistory() {
        if (!currentUser) return;
        
        try {
            await UserSync.clearUserChats(currentUser.email);
            await startNewChat();
            await loadChatHistory();
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    }

    // Toggle history menu
    function toggleHistoryMenu() {
        isHistoryMenuOpen = !isHistoryMenuOpen;
        historyMenu.classList.toggle('show');
        if (isHistoryMenuOpen) {
            loadChatHistory();
            // Adjust main container width when history is open
            chatContainer.style.width = 'calc(100% - 300px)';
        } else {
            chatContainer.style.width = '100%';
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
        
        // Add initial greeting and save it
        const greeting = 'Hello! I can help you understand this page better. Ask me to summarize the content or find specific information.';
        setTimeout(async () => {
            await typeMessage(greeting);
            // Save the greeting as the first message
            await saveChat([{ content: greeting, isUser: false }]);
        }, 500);
        
        // Close history menu and refresh it
        if (isHistoryMenuOpen) {
            toggleHistoryMenu();
        }
        await loadChatHistory();
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
        try {
            // First try getting the tab from the side panel context
            const [tab] = await chrome.tabs.query({ 
                active: true, 
                lastFocusedWindow: true 
            });
            return tab;
        } catch (error) {
            console.error('Error getting current tab:', error);
            return null;
        }
    }

    function showTypingIndicator() {
        typingIndicator.style.display = 'block';
        scrollToBottom();
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

    function scrollToBottom(smooth = true) {
        requestAnimationFrame(() => {
            const chatContainer = document.getElementById('chatContainer');
            chatContainer.scrollTo({
                top: chatContainer.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            });
        });
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
        
        // Force immediate scroll
        scrollToBottom(false);
        
        // Then smooth scroll after a brief delay to ensure content is rendered
        setTimeout(() => {
            scrollToBottom(true);
        }, 50);
        
        return messageDiv;
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
            scrollToBottom(true);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    // Add scroll handling for dynamic content
    const observer = new MutationObserver(() => {
        scrollToBottom();
    });

    observer.observe(chatContainer, {
        childList: true,
        subtree: true
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        scrollToBottom(false);
    });

    async function getPageContent() {
        const tab = await getCurrentTab();
        if (!tab) {
            throw new Error('No active tab found');
        }

        // Don't try to get content from chrome:// URLs
        if (tab.url.startsWith('chrome://')) {
            throw new Error('Cannot access Chrome internal pages');
        }

        return new Promise((resolve, reject) => {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['pdf.js', 'pdf.worker.js', 'content.js']
            }).catch(() => {
                // Script might already be injected, continue
            }).finally(() => {
                chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (!response) {
                        reject(new Error('No response from content script'));
                    } else if (!response.success) {
                        reject(new Error(response.error || 'Failed to get page content'));
                    } else {
                        if (response.isPDF) {
                            console.log('Processing PDF content');
                        }
                        resolve(response.content);
                    }
                });
            });
        });
    }

    async function scrollToContent(searchText) {
        if (!searchText) return;

        const tab = await getCurrentTab();
        if (!tab) return;

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: (text) => {
                    return window.find(text);
                },
                args: [searchText]
            });
        } catch (error) {
            console.error('Error scrolling to content:', error);
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

        messageInput.value = '';
        messageInput.disabled = true;
        sendButton.disabled = true;

        try {
            // Add user message to UI
            addMessage(userMessage, true);
            showTypingIndicator();

            const pageContent = await getPageContent();
            if (!pageContent) {
                throw new Error('Failed to get page content');
            }

            const truncatedContent = pageContent.slice(0, 15000);

            const messages = [
                {
                    role: 'system',
                    content: `You are a helpful AI assistant that helps users understand web pages and navigate to specific content. Your name is Clarify. When users ask to find or navigate to specific content, respond with the relevant information and include "NAVIGATE: " followed by the exact text to find in quotes. Always confirm when you've found the requested section. Please also respond in the most concise way possible unless asked to elaborate/go in depth.`
                },
                {
                    role: 'user',
                    content: `Page content: ${truncatedContent}\n\nUser question: ${userMessage}`
                }
            ];

            const aiResponse = await sendToChatGPT(messages);
            hideTypingIndicator();
            
            if (aiResponse && aiResponse.trim()) {
                const navigationMatch = aiResponse.match(/NAVIGATE:\s*"([^"]+)"/i);
                
                // First show the response
                const cleanResponse = aiResponse.replace(/NAVIGATE:\s*"[^"]+"/i, '').trim();
                await typeMessage(cleanResponse);

                // Save the chat messages immediately after showing them
                if (currentUser) {
                    try {
                        const newMessages = [
                            { content: userMessage, isUser: true },
                            { content: cleanResponse, isUser: false }
                        ];
                        await saveChat(newMessages);
                    } catch (error) {
                        console.error('Error saving chat:', error);
                    }
                }

                // Then handle navigation if present
                if (navigationMatch) {
                    const textToFind = navigationMatch[1].trim();
                    const tab = await getCurrentTab();
                    
                    if (!tab) {
                        const errorMessage = "Sorry, I couldn't find the active tab.";
                        await typeMessage(errorMessage);
                        await saveChat([{ content: errorMessage, isUser: false }]);
                        return;
                    }

                    try {
                        const scrollMessage = "I'll scroll to the relevant section now...";
                        await typeMessage(scrollMessage);
                        await saveChat([{ content: scrollMessage, isUser: false }]);
                        
                        // Ensure content script is loaded
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['content.js']
                        }).catch(() => {});
                        
                        // Try with exact text first
                        const response = await chrome.tabs.sendMessage(tab.id, {
                            action: 'scrollToText',
                            searchText: textToFind
                        });

                        if (!response?.success) {
                            // Try with shorter versions of the text
                            const phrases = textToFind
                                .split(/[.,;]/)
                                .map(p => p.trim())
                                .filter(p => p.length > 8)
                                .sort((a, b) => b.length - a.length);

                            for (const phrase of phrases) {
                                const retryResponse = await chrome.tabs.sendMessage(tab.id, {
                                    action: 'scrollToText',
                                    searchText: phrase
                                });

                                if (retryResponse?.success) {
                                    const successMessage = "✓ Found and scrolled to the relevant section.";
                                    await typeMessage(successMessage);
                                    await saveChat([{ content: successMessage, isUser: false }]);
                                    return;
                                }
                            }
                            
                            const notFoundMessage = "Sorry, I couldn't find that exact section. Please try with different keywords.";
                            await typeMessage(notFoundMessage);
                            await saveChat([{ content: notFoundMessage, isUser: false }]);
                        } else {
                            const successMessage = "✓ Found and scrolled to the section.";
                            await typeMessage(successMessage);
                            await saveChat([{ content: successMessage, isUser: false }]);
                        }
                    } catch (error) {
                        console.error('Scroll error:', error);
                        const errorMessage = "Sorry, I couldn't scroll to that section. Please try again.";
                        await typeMessage(errorMessage);
                        await saveChat([{ content: errorMessage, isUser: false }]);
                    }
                }
            }
        } catch (error) {
            console.error('Error in handleMessage:', error);
            hideTypingIndicator();
            const errorMessage = error.message || 'Sorry, there was an error processing your request. Please try again.';
            await typeMessage(errorMessage);
            await saveChat([{ content: errorMessage, isUser: false }]);
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
        
        const confirmLogout = confirm('Are you sure you want to log out?');
        if (!confirmLogout) return;
        
        try {
            await UserSync.removeCurrentUser();
            currentUser = null;
            
            // Clear chat and reset UI
            chatContainer.innerHTML = '';
            chatContainer.appendChild(typingIndicator);
            currentChatId = generateChatId();
            
            // Reset auth form
            authForm.reset();
            authSubmit.textContent = 'Sign In';
            authToggle.textContent = 'Sign Up';
            authToggle.previousElementSibling.textContent = "Don't have an account? ";
            hideAuthError();
            
            authOverlay.style.display = 'flex';
            
            if (isHistoryMenuOpen) {
                toggleHistoryMenu();
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        }
    }

    // Add logout button event listener
    logoutButton.addEventListener('click', handleLogout);

    // Add window resize handling for side panel
    window.addEventListener('resize', () => {
        // Adjust chat container height if needed
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) {
            chatContainer.style.height = `${window.innerHeight - 120}px`; // Adjust for input area
        }
    });
}); 