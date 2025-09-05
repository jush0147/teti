# MisaMino Bot Integration for TETI

This document describes the integration of the MisaMino AI bot into TETI's zen/custom mode.

## Overview

The MisaMino bot is an AI tetris player that can automatically play tetris by analyzing the board state and making optimal moves. This integration allows players to toggle between manual play and AI assistance in zen/custom mode.

## Features

- **Toggle Switch**: A "BOT" button in the settings panel that enables/disables the AI
- **Mode Restriction**: Bot only works in Zen/Custom mode to maintain competitive integrity
- **Real-time Analysis**: Bot analyzes the current board state and provides move suggestions
- **Automatic Execution**: Bot automatically executes suggested moves when enabled
- **Visual Feedback**: Button changes color to indicate bot status

## How It Works

### 1. Bot Initialization
- Downloads MisaMino WebAssembly files on first use
- Initializes a Web Worker for bot calculations
- Sets up communication between TETI and the bot

### 2. Game State Conversion
- Converts TETI's board representation to TBP (Tetris Bot Protocol) format
- Extracts current piece, queue, and hold information
- Sends game state to MisaMino bot for analysis

### 3. Move Execution
- Receives move suggestions from the bot
- Converts bot moves to TETI movement commands
- Executes moves using TETI's movement system
- Requests new suggestions after each piece placement

### 4. User Control
- Players can toggle bot on/off at any time
- Bot respects game pause and end states
- Seamless transition between manual and automatic play

## Technical Implementation

### Files Added/Modified

#### New Files:
- `src/features/misamino.js` - Main bot integration class
- `assets/misamino/misaImport.js` - Web Worker script
- `assets/misamino/misamino.js` - MisaMino JavaScript module
- `assets/misamino/misamino.wasm` - MisaMino WebAssembly binary

#### Modified Files:
- `src/game.js` - Added bot initialization and hooks
- `src/mechanics/locking.js` - Added bot state change notifications
- `src/features/modes.js` - Added bot button visibility logic
- `index.html` - Added bot toggle button
- `styles/style.css` - Added bot button styling

### Key Classes and Methods

#### MisaMinoBot Class
- `init()` - Initializes the bot and Web Worker
- `toggle()` - Toggles bot on/off (zen/custom mode only)
- `sendGameState()` - Converts and sends game state to bot
- `executeMove()` - Executes bot-suggested moves
- `onGameStateChange()` - Called when game state changes

#### Integration Points
- Game initialization: `Game.misamino.init()`
- Game start: `Game.misamino.onGameStart()`
- Game end: `Game.misamino.onGameEnd()`
- Piece placement: `Game.misamino.onGameStateChange()`

## Usage Instructions

### For Players:
1. Switch to Zen/Custom mode
2. Click the "BOT" button in the settings panel
3. The bot will start analyzing and playing automatically
4. Click the button again to return to manual control

### For Developers:
1. The bot is automatically initialized when the game loads
2. Bot state can be checked via `Game.misamino.isActive`
3. Bot can be controlled programmatically via `Game.misamino.toggle()`

## GitHub Pages Compatibility

The integration is fully compatible with GitHub Pages:
- Uses relative paths for all resources
- No server-side dependencies
- WebAssembly files are served as static assets
- Web Workers function correctly in GitHub Pages environment

## Performance Considerations

- Bot calculations run in a Web Worker (non-blocking)
- Move execution is throttled to prevent overwhelming the game
- Bot automatically stops when game ends or is paused
- Minimal impact on game performance when disabled

## Troubleshooting

### Common Issues:

1. **Bot button not visible**
   - Ensure you're in Zen/Custom mode
   - Button is hidden in other game modes

2. **Bot not responding**
   - Check browser console for errors
   - Ensure WebAssembly is supported
   - Verify all bot files are loaded correctly

3. **Moves seem incorrect**
   - Bot analyzes current game state
   - May take suboptimal moves in unusual board configurations
   - Consider restarting the game for a fresh analysis

### Debug Mode:
Enable browser console to see detailed bot communication logs.

## Future Enhancements

Potential improvements for future versions:
- Adjustable bot difficulty/speed settings
- Bot move preview before execution
- Statistics tracking for bot performance
- Support for other AI bots
- Custom bot configuration options

## Credits

- MisaMino bot by misakamm
- MisaMinoTBP (WebAssembly port) by jezevec10
- Integration developed for TETI by TitanPlayz100 and the contributors 