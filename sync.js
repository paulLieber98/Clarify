// Sync user data across devices using chrome.storage.local for persistence
const UserSync = {
    async getUsers() {
        try {
            const result = await chrome.storage.local.get(['users']);
            return result.users || {};
        } catch (error) {
            console.error('Error getting users:', error);
            return {};
        }
    },

    async saveUser(email, userData) {
        try {
            const users = await this.getUsers();
            users[email] = userData;
            await chrome.storage.local.set({ users });
            return true;
        } catch (error) {
            console.error('Error saving user:', error);
            return false;
        }
    },

    async getCurrentUser() {
        try {
            const result = await chrome.storage.local.get(['currentUser']);
            return result.currentUser;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    },

    async setCurrentUser(user) {
        try {
            await chrome.storage.local.set({ currentUser: user });
            return true;
        } catch (error) {
            console.error('Error setting current user:', error);
            return false;
        }
    },

    async removeCurrentUser() {
        try {
            await chrome.storage.local.remove(['currentUser']);
            return true;
        } catch (error) {
            console.error('Error removing current user:', error);
            return false;
        }
    },

    async saveCurrentChatId(email, chatId) {
        try {
            // Store current chat ID in local storage
            await chrome.storage.local.set({ [`current_chat_${email}`]: chatId });
            return true;
        } catch (error) {
            console.error('Error saving current chat ID:', error);
            return false;
        }
    },

    async getCurrentChatId(email) {
        try {
            const result = await chrome.storage.local.get([`current_chat_${email}`]);
            return result[`current_chat_${email}`];
        } catch (error) {
            console.error('Error getting current chat ID:', error);
            return null;
        }
    },

    // Keep chat history in local storage due to size limitations
    async saveUserChat(email, chatId, messages) {
        try {
            const userChatsKey = `chats_${email}`;
            const storage = await chrome.storage.local.get([userChatsKey]);
            const chats = storage[userChatsKey] || {};
            
            const chatData = messages.messages ? messages : {
                timestamp: new Date().toISOString(),
                messages: messages
            };

            console.log('Saving chat data:', chatData);
            
            chats[chatId] = chatData;
            
            await chrome.storage.local.set({ [userChatsKey]: chats });
            await this.saveCurrentChatId(email, chatId);
            
            console.log('Saved chats:', chats);
            return true;
        } catch (error) {
            console.error('Error saving chat:', error);
            return false;
        }
    },

    async getUserChats(email) {
        try {
            const userChatsKey = `chats_${email}`;
            const storage = await chrome.storage.local.get([userChatsKey]);
            const chats = storage[userChatsKey] || {};
            
            console.log('Retrieved chats:', chats);
            return chats;
        } catch (error) {
            console.error('Error getting user chats:', error);
            return {};
        }
    },

    async deleteUserChat(email, chatId) {
        try {
            const userChatsKey = `chats_${email}`;
            const storage = await chrome.storage.local.get([userChatsKey]);
            const chats = storage[userChatsKey] || {};
            
            if (chats[chatId]) {
                delete chats[chatId];
                await chrome.storage.local.set({ [userChatsKey]: chats });
                
                const currentChatId = await this.getCurrentChatId(email);
                if (currentChatId === chatId) {
                    await this.saveCurrentChatId(email, null);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting chat:', error);
            return false;
        }
    },

    async clearUserChats(email) {
        try {
            const userChatsKey = `chats_${email}`;
            await chrome.storage.local.remove([userChatsKey]);
            await this.saveCurrentChatId(email, null);
            return true;
        } catch (error) {
            console.error('Error clearing chats:', error);
            return false;
        }
    }
}; 