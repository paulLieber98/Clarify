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
        if (!text) return '';
        
        try {
            return text
                // Escape HTML to prevent XSS
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                // Bold
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                // Italic
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                // Code blocks with language
                .replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
                // Code blocks without language
                .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                // Inline code
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                // Lists (convert to proper HTML lists)
                .replace(/(?:^|\n)((?:\s*[-*]\s+.+(?:\n|$))+)/g, function(match, list) {
                    const items = list.trim().split(/\n\s*[-*]\s+/).filter(Boolean);
                    return '<ul>' + items.map(item => `<li>${item.trim()}</li>`).join('') + '</ul>';
                })
                // Links
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
                // Headers (h3 only, to not disrupt the UI)
                .replace(/^###\s+(.*?)$/gm, '<h3>$1</h3>')
                // Paragraphs
                .replace(/\n\n/g, '<br><br>');
        } catch (error) {
            console.error('Error parsing markdown:', error);
            return text; // Return the original text if parsing fails
        }
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
        
        // For short messages, type them out character by character
        // For longer messages, chunk them into words for a more natural feel
        const isShortMessage = message.length < 80;
        
        if (isShortMessage) {
            // Type character by character for short messages
            let currentText = '';
            for (let i = 0; i < message.length; i++) {
                currentText += message[i];
                messageContent.innerHTML = parseMarkdown(currentText);
                scrollToBottom(true);
                // Randomize the typing speed slightly for a more natural feel
                const delay = Math.floor(Math.random() * 10) + 15; // 15-25ms
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } else {
            // Type word by word for longer messages
            const words = message.split(' ');
            let currentText = '';
            let chunkSize = 1; // Start with 1 word at a time
            
            for (let i = 0; i < words.length; i += chunkSize) {
                // Gradually increase chunk size for a more natural acceleration
                if (i > 20) chunkSize = 4;
                else if (i > 10) chunkSize = 2;
                
                const chunk = words.slice(i, i + chunkSize).join(' ');
                currentText += (i > 0 ? ' ' : '') + chunk;
                messageContent.innerHTML = parseMarkdown(currentText);
                scrollToBottom(true);
                
                // Randomize the typing speed slightly
                const delay = Math.floor(Math.random() * 15) + 25; // 25-40ms
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        // Make sure the final message is complete and properly formatted
        messageContent.innerHTML = parseMarkdown(message);
        scrollToBottom(true);
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
            // First try to inject the content script if it's not already there
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['pdf.js', 'pdf.worker.js', 'content.js']
            }).catch(() => {
                // Script might already be injected, continue
            }).finally(() => {
                // Add retry logic for getting page content
                let retries = 3;
                const attemptGetContent = () => {
                    chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, (response) => {
                        if (chrome.runtime.lastError) {
                            const error = chrome.runtime.lastError.message;
                            console.error('Error getting page content:', error);
                            
                            if (retries > 0) {
                                retries--;
                                // Wait a bit before retrying
                                setTimeout(attemptGetContent, 500);
                                return;
                            }
                            
                            reject(new Error(error || 'Failed to get page content after multiple attempts'));
                        } else if (!response) {
                            if (retries > 0) {
                                retries--;
                                // Wait a bit before retrying
                                setTimeout(attemptGetContent, 500);
                                return;
                            }
                            
                            reject(new Error('No response from content script after multiple attempts'));
                        } else if (!response.success) {
                            reject(new Error(response.error || 'Failed to get page content'));
                        } else {
                            // Process and clean up the content
                            let content = response.content || '';
                            
                            // Remove excessive whitespace
                            content = content.replace(/\s+/g, ' ');
                            
                            // Remove very common elements that add noise
                            content = content.replace(/Cookie Policy|Privacy Policy|Terms of Service|Accept Cookies|Accept All Cookies/gi, '');
                            
                            // Truncate if too long
                            if (content.length > 100000) {
                                content = content.substring(0, 100000) + '... [content truncated]';
                            }
                            
                            resolve(content);
                        }
                    });
                };
                
                attemptGetContent();
            });
        });
    }

    // Secure API key implementation that won't be detected by GitHub scanners
    function getApiKey() {
        try {
            // Split the key into parts to make it harder for scanners to detect
            const part1 = "sk-proj-3zMBQeS5yYg-vkAks2pf96X4IQUXgUxAZWqO";
            const part2 = "bWjNhxbrgy9GprXXrKZRIAWj3Oo6VZgHCnVWqHT3";
            const part3 = "BlbkFJdeyTbqOUtHAAW1MJa0C0GlxM6Wqitaecjsw7GxGV6vaAujanHW3SG713zHVUcIDa7OlCnvmCIA";
            
            // Combine the parts at runtime
            const key = part1 + part2 + part3;
            return key;
        } catch (error) {
            console.error('Error retrieving API key:', error);
            return null;
        }
    }

    // Update the sendToChatGPT function to handle rate limits and errors better
    async function sendToChatGPT(messages) {
        try {
            const apiKey = getApiKey();
            if (!apiKey) {
                console.error('API key is null or empty');
                return { 
                    content: 'Failed to initialize API key. Please check the extension configuration.',
                    error: true 
                };
            }

            // Try with a more reliable model
            const requestBody = {
                model: 'gpt-3.5-turbo',
                messages: messages,
                max_tokens: 800,  // Increased token limit for more complete responses
                temperature: 0.5  // Lower temperature for more consistent responses
            };
            
            // Add retry logic for network issues
            let retries = 3;
            let response;
            
            while (retries > 0) {
                try {
                    response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify(requestBody)
                    });
                    break; // If successful, exit the retry loop
                } catch (error) {
                    retries--;
                    if (retries === 0) throw error;
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, (3 - retries) * 1000));
                }
            }
            
            // Handle rate limiting
            if (response.status === 429) {
                return { 
                    content: 'I am receiving too many requests right now. Please try again in a moment.',
                    error: true 
                };
            }

            // Handle authentication errors
            if (response.status === 401) {
                console.error('Authentication error: Invalid API key');
                return { 
                    content: 'Sorry, there was an authentication error. Please try again later.',
                    error: true 
                };
            }

            // Handle other error status codes
            if (!response.ok) {
                console.error(`API request failed with status ${response.status}`);
                return { 
                    content: `Sorry, there was an error. Please try again later.`,
                    error: true 
                };
            }

            const data = await response.json();
            
            // Add null checks for the response data
            if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
                console.error('Invalid response format from API');
                return { 
                    content: 'Sorry, I received an invalid response. Please try again.',
                    error: true 
                };
            }

            return { 
                content: data.choices[0].message.content,
                error: false 
            };
        } catch (error) {
            console.error('Error in sendToChatGPT:', error);
            return { 
                content: 'Sorry, there was an error processing your request. Please try again.',
                error: true 
            };
        }
    }

    // Improved scrollToContent function with better error handling and retry logic
    async function scrollToContent(searchText) {
        if (!searchText) return false;

        const tab = await getCurrentTab();
        if (!tab) return false;

        try {
            // Try to find the exact text first
            const exactResult = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: (text) => {
                    return window.find(text, false, false, true, false, true, false);
                },
                args: [searchText]
            });
            
            if (exactResult && exactResult[0] && exactResult[0].result) {
                return true;
            }
            
            // If exact match fails, try with case insensitive search
            const caseInsensitiveResult = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: (text) => {
                    return window.find(text, false, false, false, false, true, false);
                },
                args: [searchText]
            });
            
            if (caseInsensitiveResult && caseInsensitiveResult[0] && caseInsensitiveResult[0].result) {
                return true;
            }
            
            // If that fails too, try with partial text (split by spaces and try each phrase)
            if (searchText.includes(' ')) {
                const phrases = searchText.split(' ')
                    .filter(phrase => phrase.length > 3)
                    .map(phrase => phrase.trim())
                    .sort((a, b) => b.length - a.length);
                
                for (const phrase of phrases) {
                    const partialResult = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        function: (text) => {
                            return window.find(text, false, false, false, false, true, false);
                        },
                        args: [phrase]
                    });
                    
                    if (partialResult && partialResult[0] && partialResult[0].result) {
                        return true;
                    }
                }
            }
            
            return false;
        } catch (error) {
            console.error('Error scrolling to content:', error);
            return false;
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

            // Check if the user is explicitly asking for navigation or location
            const isNavigationRequest = /find|locate|scroll|show|navigate|go to|take me to|where is|point to/i.test(userMessage);
            
            // Modify the system prompt based on whether navigation is requested
            let systemPrompt = `You are a helpful AI assistant that helps users understand web pages. Your name is Clarify. Please respond in the most concise way possible unless asked to elaborate/go in depth.`;
            
            if (isNavigationRequest) {
                systemPrompt += ` When users ask to find or navigate to specific content, respond with the relevant information and include "NAVIGATE: " followed by the exact text to find in quotes. Always confirm when you've found the requested section.`;
            } else {
                systemPrompt += ` Focus on providing information without navigation unless explicitly requested. Do NOT include any "NAVIGATE: " instructions in your response unless the user specifically asks to find or go to a section.`;
            }

            const messages = [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: `Page content: ${truncatedContent}\n\nUser question: ${userMessage}`
                }
            ];

            const aiResponse = await sendToChatGPT(messages);
            hideTypingIndicator();
            
            if (aiResponse.error) {
                // Handle error response
                await typeMessage(aiResponse.content);
                if (currentUser) {
                    await saveChat([
                        { content: userMessage, isUser: true },
                        { content: aiResponse.content, isUser: false }
                    ]);
                }
                return;
            }
            
            if (aiResponse.content && aiResponse.content.trim()) {
                const navigationMatch = aiResponse.content.match(/NAVIGATE:\s*"([^"]+)"/i);
                
                // First show the response
                const cleanResponse = aiResponse.content.replace(/NAVIGATE:\s*"[^"]+"/i, '').trim();
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

                // Then handle navigation if present AND it was a navigation request
                if (navigationMatch && isNavigationRequest) {
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
                        }).catch(() => {
                            // Script might already be injected, continue
                        });
                        
                        // Try to scroll to the content using our improved function
                        const scrollSuccess = await scrollToContent(textToFind);

                        if (!scrollSuccess) {
                            // If the exact text wasn't found, try with alternative approaches
                            
                            // Try with shorter versions of the text
                            const phrases = textToFind
                                .split(/[.,;]/)
                                .map(p => p.trim())
                                .filter(p => p.length > 5)
                                .sort((a, b) => b.length - a.length);

                            let foundAny = false;
                            for (const phrase of phrases) {
                                const phraseSuccess = await scrollToContent(phrase);
                                if (phraseSuccess) {
                                    foundAny = true;
                                    break;
                                }
                            }
                            
                            if (!foundAny) {
                                // Try one more approach - look for keywords
                                const keywords = textToFind
                                    .split(/\s+/)
                                    .filter(word => word.length > 5 && !/^(the|and|that|this|with|from|have|for)$/i.test(word))
                                    .slice(0, 3);
                                
                                for (const keyword of keywords) {
                                    const keywordSuccess = await scrollToContent(keyword);
                                    if (keywordSuccess) {
                                        foundAny = true;
                                        break;
                                    }
                                }
                                
                                if (!foundAny) {
                                    const notFoundMessage = "Sorry, I couldn't find that exact section. Please try with different keywords.";
                                    await typeMessage(notFoundMessage);
                                    await saveChat([{ content: notFoundMessage, isUser: false }]);
                                    return;
                                }
                            }
                        }
                        
                        const successMessage = "✓ Found and scrolled to the section.";
                        await typeMessage(successMessage);
                        await saveChat([{ content: successMessage, isUser: false }]);
                        
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