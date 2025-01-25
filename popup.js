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

    // You'll need to replace this with your actual OpenAI API key
    const OPENAI_API_KEY = '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';

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
            // Try multiple times if needed
            for (let attempt = 0; attempt < 2; attempt++) {
                const response = await chrome.tabs.sendMessage(tab.id, {
                    action: 'scrollToText',
                    searchText: searchText
                });
                
                if (response && response.success) {
                    return true;
                }
                
                // Small delay before retry
                if (attempt === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // If message passing failed, fall back to executeScript
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: (text) => {
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

                    const searchTextLower = text.toLowerCase().trim();
                    
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
                },
                args: [searchText]
            });
        } catch (error) {
            console.error('Error scrolling to content:', error);
            // Final fallback
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: (text) => {
                    window.find(text);
                },
                args: [searchText]
            });
        }
    }

    async function sendToChatGPT(messages) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini-2024-07-18',
                    messages: messages,
                    max_tokens: 500
                })
            });

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error:', error);
            return 'Sorry, there was an error processing your request.';
        }
    }

    async function handleMessage() {
        const userMessage = messageInput.value.trim();
        if (!userMessage) return;

        messageInput.value = '';
        messageInput.disabled = true;
        sendButton.disabled = true;

        addMessage(userMessage, true);
        showTypingIndicator();

        const pageContent = await getPageContent();
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

            // Display the cleaned response without the navigation command
            await typeMessage(cleanResponse);

            // Execute the scroll if we found a navigation command
            if (navigationText) {
                setTimeout(() => {
                    scrollToContent(navigationText);
                }, 500);
            }

            // Save chat history with cleaned response
            const storage = await chrome.storage.local.get('chats');
            const chats = storage.chats || {};
            const currentChat = chats[currentChatId] || { messages: [] };
            
            currentChat.messages.push(
                { content: userMessage, isUser: true },
                { content: cleanResponse, isUser: false }
            );
            
            await saveChat(currentChat.messages);
        }

        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
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