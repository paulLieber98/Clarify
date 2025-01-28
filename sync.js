// Sync user data across devices using chrome.storage.sync instead of local
const UserSync = {
    async getUsers() {
        try {
            const result = await chrome.storage.sync.get(['users']);
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
            await chrome.storage.sync.set({ users });
            return true;
        } catch (error) {
            console.error('Error saving user:', error);
            return false;
        }
    },

    async getCurrentUser() {
        try {
            const result = await chrome.storage.sync.get(['currentUser']);
            return result.currentUser;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    },

    async setCurrentUser(user) {
        try {
            await chrome.storage.sync.set({ currentUser: user });
            return true;
        } catch (error) {
            console.error('Error setting current user:', error);
            return false;
        }
    },

    async removeCurrentUser() {
        try {
            await chrome.storage.sync.remove(['currentUser']);
            return true;
        } catch (error) {
            console.error('Error removing current user:', error);
            return false;
        }
    },

    async saveCurrentChatId(email, chatId) {
        try {
            await chrome.storage.sync.set({ [`current_chat_${email}`]: chatId });
            return true;
        } catch (error) {
            console.error('Error saving current chat ID:', error);
            return false;
        }
    },

    async getCurrentChatId(email) {
        try {
            const result = await chrome.storage.sync.get([`current_chat_${email}`]);
            return result[`current_chat_${email}`];
        } catch (error) {
            console.error('Error getting current chat ID:', error);
            return null;
        }
    },

    async saveUserChat(email, chatId, messages) {
        try {
            const userChatsKey = `chats_${email}`;
            const storage = await chrome.storage.sync.get([userChatsKey]);
            const chats = storage[userChatsKey] || {};
            
            chats[chatId] = {
                timestamp: new Date().toISOString(),
                messages: messages
            };
            
            await chrome.storage.sync.set({ [userChatsKey]: chats });
            return true;
        } catch (error) {
            console.error('Error saving chat:', error);
            return false;
        }
    },

    async getUserChats(email) {
        try {
            const userChatsKey = `chats_${email}`;
            const storage = await chrome.storage.sync.get([userChatsKey]);
            return storage[userChatsKey] || {};
        } catch (error) {
            console.error('Error getting user chats:', error);
            return {};
        }
    }
}; 