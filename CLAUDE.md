# The Roundtable - AI Discussion Platform

## Project Overview

A React-based AI discussion platform where AI personas debate topics chosen by the user. The app uses Minimax API (Anthropic compatible format) as the LLM backend with an Express.js proxy server to handle CORS.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **State Management**: Zustand with persist middleware
- **Animations**: Framer Motion
- **UI Components**: Radix UI + shadcn/ui style
- **Backend**: Express.js proxy server (port 3001)
- **LLM**: Minimax API (model: MiniMax-M2.7, Anthropic API format)
- **Persistence**: IndexedDB via idb library

## Architecture

### State Flow
```
ONBOARDING → LANDING → GENERATING_PANEL → PANEL_REVIEW → OPENING_STATEMENTS → DISCUSSION
```

### Key Files

- `src/App.tsx` - Main app with 6-state machine
- `src/stores/useAppStore.ts` - Zustand store for all app state
- `src/services/minimaxService.ts` - Minimax API client
- `src/services/promptTemplates.ts` - All LLM prompts and response parsing
- `src/components/chat/ChatBubble.tsx` - Message display
- `server.js` - Express backend proxy for Minimax API

### Backend Proxy

The Minimax API uses Anthropic-compatible endpoint:
- Server runs on port 3001
- Vite proxies `/api` requests to `http://localhost:3001`
- Client uses `/api/chat` endpoint

**API Format**: Uses `https://api.minimaxi.com/anthropic/v1/messages` endpoint with Anthropic-style messages format. The server converts between OpenAI-style (client) and Anthropic-style (API) formats.

## Current Issues (as of 2026/04/04)

### Known Bugs

1. **Third speaker's message may be truncated** - The third participant's opening statement sometimes shows "..." as placeholder when the API response is slow or truncated. This is a timing issue in the message display.

2. **Random topic button has no loading indicator** - When clicking "Random" topic, there's no visual feedback showing the request is in progress.

3. **@ mention autocomplete not working** - When user types @ in the input area, participant name autocomplete doesn't appear.

4. **AI output is not streamed** - AI responses appear all at once instead of streaming word-by-word. The streaming code is commented out due to API compatibility issues.

### Testing Status

- **Panel generation**: Working (3 participants generated with names, titles, stances)
- **Opening statements**: Working (all 3 speakers produce content)
- **Discussion auto-debate**: Working (messages flow between speakers)
- **Thinking tags**: FIXED - API now returns text blocks separately from thinking blocks
- **Summary generation**: Working

## Running the Project

```bash
# Install dependencies
npm install

# Start both backend (port 3001) and frontend (port 5173)
npm run dev

# Or start separately:
npm run server   # Backend only
npm run client   # Frontend only
```

## API Configuration

Minimax API key is stored in `.env`:
```
ANTHROPIC_API_KEY=sk-cp-...
```

The backend proxy server loads this from environment or `.env` file. The API uses Anthropic-compatible format but with Minimax's own models.

## Testing with Playwright

```javascript
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');

  // Onboarding
  await page.fill('input[placeholder="Enter your name"]', 'Tester');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(2000);

  // Summon guests
  await page.fill('textarea[placeholder="Enter your discussion topic..."]', 'Is AI dangerous?');
  await page.click('button:has-text("Summon Guests")');
  await page.waitForTimeout(30000);

  // Start discussion
  await page.click('button:has-text("Start the Roundtable")');
  await page.waitForTimeout(60000);

  const content = await page.textContent('body');
  console.log(content);

  await browser.close();
})();
```

## TODO

- [x] Fix thinking tags appearing in messages - FIXED (switched to Anthropic API format)
- [x] Panel generation hanging - FIXED (added timeout fallback)
- [x] Auto-debate not starting - FIXED (set isWaitingForUser to false after opening statements)
- [ ] Fix third speaker truncation issue
- [ ] Add loading indicator for Random topic button
- [ ] Implement @ mention autocomplete
- [ ] Enable streaming output for AI responses
- [ ] Add better error handling for API failures
- [ ] Verify all state transitions work correctly
- [ ] Test with multiple discussion topics
- [ ] Add user input during discussion (WAIT_FOR_USER state)
