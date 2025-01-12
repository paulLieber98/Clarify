# Clarify Chrome Extension

Clarify is a Chrome extension that helps users better understand and navigate web pages using ChatGPT. It provides an interactive chat interface where users can ask questions about the current page, get summaries, and navigate to specific content.

## Features

- Chat with AI about the current webpage
- Get page summaries and explanations
- Navigate to specific content by asking the AI
- Modern, user-friendly interface

## Setup

1. Clone this repository or download the files
2. Get an OpenAI API key from [OpenAI's website](https://platform.openai.com/)
3. Open `popup.js` and replace `'YOUR_API_KEY'` with your actual OpenAI API key
4. Open Chrome and go to `chrome://extensions/`
5. Enable "Developer mode" in the top right
6. Click "Load unpacked" and select the directory containing these files

## Usage

1. Click the Clarify icon in your Chrome toolbar
2. Type your question or request in the chat box
3. Press Enter or click Send to get a response

Example commands:
- "Summarize this page for me"
- "Take me to the section about X"
- "What is this page about?"
- "Find the part that talks about X"

## Security Note

Keep your OpenAI API key secure and never share it publicly. In a production environment, you should handle API keys more securely through a backend service.

## Files

- `manifest.json`: Extension configuration
- `popup.html`: Chat interface
- `popup.js`: Main functionality and ChatGPT integration
- `content.js`: Page interaction script

## Development

To modify the extension:
1. Make your changes to the code
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Clarify extension card
4. Test your changes

## License

MIT License 