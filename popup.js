document.addEventListener('DOMContentLoaded', function() {
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

    // Load and display chat history
    async function loadChatHistory() {
        const storage = await chrome.storage.local.get('chats');
        const chats = storage.chats || {};
        
        historyItems.innerHTML = '';
        
        if (Object.keys(chats).length === 0) {
            historyItems.innerHTML = '<div class="empty-history">No chat history yet</div>';
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
            
            // Get the last message for preview
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
            
            // Add click event for the content area
            itemContent.addEventListener('click', () => loadChat(chatId));
            
            // Add click event for delete button
            deleteButton.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent triggering the parent's click event
                await deleteChat(chatId);
            });
            
            historyItem.appendChild(itemContent);
            historyItem.appendChild(deleteButton);
            historyItems.appendChild(historyItem);
        }
    }

    // Delete a specific chat
    async function deleteChat(chatId) {
        const storage = await chrome.storage.local.get('chats');
        const chats = storage.chats || {};
        
        // If we're deleting the current chat, start a new one
        if (chatId === currentChatId) {
            startNewChat();
        }
        
        // Delete the chat and update storage
        delete chats[chatId];
        await chrome.storage.local.set({ chats });
        
        // Refresh the history display
        loadChatHistory();
    }

    // Load a specific chat
    async function loadChat(chatId) {
        const storage = await chrome.storage.local.get('chats');
        const chats = storage.chats || {};
        const chat = chats[chatId];
        
        if (chat) {
            // Clear current chat
            chatContainer.innerHTML = '';
            chatContainer.appendChild(typingIndicator);
            
            // Load messages
            for (const message of chat.messages) {
                addMessage(message.content, message.isUser);
            }
            
            currentChatId = chatId;
            
            // Close history menu
            toggleHistoryMenu();
        }
    }

    // Save current chat
    async function saveChat(messages) {
        const storage = await chrome.storage.local.get('chats');
        const chats = storage.chats || {};
        const tab = await getCurrentTab();
        
        chats[currentChatId] = {
            url: tab.url,
            messages: messages,
            timestamp: Date.now()
        };
        
        await chrome.storage.local.set({ chats });
        loadChatHistory();
    }

    // Clear all chat history
    async function clearHistory() {
        await chrome.storage.local.set({ chats: {} });
        loadChatHistory();
        
        // Reset current chat
        chatContainer.innerHTML = '';
        chatContainer.appendChild(typingIndicator);
        currentChatId = generateChatId();
        
        // Add initial greeting
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
        
        // Generate new chat ID
        currentChatId = generateChatId();
        
        // Add initial greeting
        setTimeout(() => {
            typeMessage('Hello! I can help you understand this page better. Ask me to summarize the content or find specific information.');
        }, 500);
        
        // Close history menu
        toggleHistoryMenu();
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
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: (text) => {
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );

                let node;
                while (node = walker.nextNode()) {
                    if (node.textContent.toLowerCase().includes(text.toLowerCase())) {
                        node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        break;
                    }
                }
            },
            args: [searchText]
        });
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
                content: 'You are a very helpful and intelligent assistant that helps users understand web pages and navigate to specific content. Your name is Clarify. If the user asks to find something, respond with the exact text to search for after your explanation. Please scroll to the specific text that the user asks for--if they do ask to find some specific information. '
            },
            {
                role: 'user',
                content: `Page content: ${pageContent}\n\nUser question: ${userMessage}`
            }
        ];

        const aiResponse = await sendToChatGPT(messages);
        hideTypingIndicator();
        
        if (aiResponse && aiResponse.trim()) {
            await typeMessage(aiResponse);

            // Save chat history
            const storage = await chrome.storage.local.get('chats');
            const chats = storage.chats || {};
            const currentChat = chats[currentChatId] || { messages: [] };
            
            currentChat.messages.push(
                { content: userMessage, isUser: true },
                { content: aiResponse, isUser: false }
            );
            
            await saveChat(currentChat.messages);

            if (aiResponse.includes('NAVIGATE:')) {
                const match = aiResponse.match(/"([^"]+)"/);
                if (match) {
                    setTimeout(() => {
                        scrollToContent(match[1].trim());
                    }, 500);
                }
            }
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

    // Initial greeting with typing animation
    setTimeout(() => {
        typeMessage('Hello! I can help you understand this page better. Ask me to summarize the content or find specific information.');
    }, 500);
}); 