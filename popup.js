document.addEventListener('DOMContentLoaded', function() {
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');

    // You'll need to replace this with your actual OpenAI API key
    const OPENAI_API_KEY = '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';

    async function getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    function addMessage(content, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : ''}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;
        
        messageDiv.appendChild(messageContent);
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
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
                    model: 'gpt-3.5-turbo',
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

        // Clear input
        messageInput.value = '';

        // Add user message to chat
        addMessage(userMessage, true);

        // Get page content
        const pageContent = await getPageContent();

        // Prepare messages for ChatGPT
        const messages = [
            {
                role: 'system',
                content: 'You are a helpful assistant that helps users understand web pages and navigate to specific content. If the user asks to find something, respond with the exact text to search for after your explanation.'
            },
            {
                role: 'user',
                content: `Page content: ${pageContent}\n\nUser question: ${userMessage}`
            }
        ];

        // Get AI response
        const aiResponse = await sendToChatGPT(messages);
        addMessage(aiResponse);

        // Check if we need to scroll to content
        if (userMessage.toLowerCase().includes('take me to') || 
            userMessage.toLowerCase().includes('find') || 
            userMessage.toLowerCase().includes('where is')) {
            // Extract the last quoted text or the last sentence from AI response
            const match = aiResponse.match(/"([^"]+)"/) || aiResponse.match(/[^.!?]+[.!?]$/);
            if (match) {
                const searchText = match[1] || match[0];
                scrollToContent(searchText.trim());
            }
        }
    }

    // Event listeners
    sendButton.addEventListener('click', handleMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleMessage();
        }
    });

    // Initial greeting
    addMessage('Hello! I can help you understand this page better. Ask me to summarize the content or find specific information.');
}); 