import { Game } from "../main.js";

export class MisaMinoBot {
    constructor() {
        this.worker = null;
        this.isActive = false;
        this.isInitialized = false;
        this.pendingSuggestion = false;
        this.currentMoves = [];
        this.moveIndex = 0;
        this.autoPlayInterval = null;
        this.autoPlayDelay = 500; // 500ms between moves
        this.singleRun = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Use relative path that works both locally and on GitHub Pages
            const workerPath = new URL('./assets/misamino/misaImport.js', window.location.origin + window.location.pathname.replace(/[^/]*$/, ''));
            this.worker = new Worker(workerPath);
            this.worker.onmessage = (e) => this.handleWorkerMessage(e);
            this.worker.onerror = (error) => {
                console.error('MisaMino Worker Error:', error);
                Game.modals.generate.notif("MisaMino Error", "Failed to initialize bot", "error");
            };
            
            this.isInitialized = true;
            console.log('MisaMino bot initialized successfully');
        } catch (error) {
            console.error('Failed to initialize MisaMino bot:', error);
            Game.modals.generate.notif("MisaMino Error", "Failed to load bot files", "error");
        }
    }

    handleWorkerMessage(e) {
        const data = e.data;
        // Debug log to verify message shape
        console.debug('MisaMino worker message:', data);

        // Accept both explicit 'suggestion' and any payload with moves array
        if (this.isActive && (data.type === 'suggestion' || Array.isArray(data.moves))) {
            this.currentMoves = data.moves || [];
            this.moveIndex = 0;
            this.pendingSuggestion = false;

            if (this.currentMoves.length > 0) {
                this.executeMoves();
            } else if (this.singleRun) {
                Game.modals.generate.notif("MisaMino", "No moves returned", "error");
                this.singleRun = false;
                this.isActive = false;
                this.stopBot();
            }
        }
    }

    toggle() {
        if (!this.isInitialized) {
            Game.modals.generate.notif("MisaMino", "Bot not initialized", "error");
            return;
        }

        // Check if we're in zen/custom mode
        if (Game.settings.game.gamemode !== 'custom') {
            Game.modals.generate.notif("MisaMino", "Bot only works in Zen/Custom mode", "error");
            return;
        }

        this.isActive = !this.isActive;
        
        if (this.isActive) {
            this.startBot();
        } else {
            this.stopBot();
        }
        
        // Update UI toggle state
        const toggleButton = document.getElementById('misamino-toggle');
        if (toggleButton) {
            const buttonText = toggleButton.querySelector('span');
            if (buttonText) {
                buttonText.textContent = this.isActive ? 'BOT ON' : 'BOT';
            }
            toggleButton.classList.toggle('active', this.isActive);
        }
        
        Game.modals.generate.notif("MisaMino", this.isActive ? "Bot enabled" : "Bot disabled", "info");
    }

    // Run bot once: request a single suggestion and execute it, do not loop
    runOnce() {
        if (!this.isInitialized) {
            Game.modals.generate.notif("MisaMino", "Bot not initialized", "error");
            return;
        }
        if (Game.settings.game.gamemode !== 'custom') {
            Game.modals.generate.notif("MisaMino", "Custom mode only", "error");
            return;
        }
        if (Game.ended) return;

        this.singleRun = true;
        this.isActive = true;
        this.currentMoves = [];
        this.moveIndex = 0;
        this.pendingSuggestion = false;
        this.sendGameState();
        this.requestSuggestion();

        // Flash button feedback
        const btn = document.getElementById('misamino-ingame');
        if (btn) {
            btn.style.filter = 'brightness(1.2)';
            setTimeout(() => btn.style.filter = '', 150);
        }
    }

    startBot() {
        if (!this.worker || Game.ended) return;
        
        // Send initial game state
        this.sendGameState();
        this.requestSuggestion();
    }

    stopBot() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
        
        this.currentMoves = [];
        this.moveIndex = 0;
        this.pendingSuggestion = false;
        
        if (this.worker) {
            this.worker.postMessage({ type: "stop" });
        }
    }

    sendGameState() {
        if (!this.worker || !this.isActive) return;

        const board = this.convertBoardToTBPFormat();
        const queue = this.getQueueArray();
        const hold = this.getHoldPiece();
        
        const gameState = {
            type: "start",
            hold: hold,
            queue: queue,
            combo: Game.stats.combo >= 0 ? Game.stats.combo : 0,
            back_to_back: Game.stats.btb > 0,
            board: board
        };
        
        this.worker.postMessage(gameState);
    }

    requestSuggestion() {
        if (!this.worker || !this.isActive || this.pendingSuggestion) return;
        
        this.pendingSuggestion = true;
        this.worker.postMessage({ type: "suggest" });
    }

    convertBoardToTBPFormat() {
        const board = [];
        
        // TBP format expects 40 rows, 10 columns (bottom to top)
        // TETI board is indexed from bottom to top as well
        for (let y = 0; y < 40; y++) {
            const row = [];
            for (let x = 0; x < 10; x++) {
                let cellValue = null;
                const boardPos = [x, y];
                const cellContents = (Game.board.boardState[y] && Game.board.boardState[y][x]) || "";

                // Solid placed minos are marked with 'S'. Extract the piece token if present.
                if (Game.board.checkMino(boardPos, "S")) {
                    const tokens = cellContents.split(" ").filter(Boolean);
                    // Prefer explicit piece tokens
                    const pieceToken = tokens.find(t => {
                        const up = t.toUpperCase();
                        return ["I","O","T","S","Z","J","L"].includes(up);
                    });
                    if (pieceToken) {
                        cellValue = this.convertPieceType(pieceToken);
                    } else if (tokens.includes("G")) {
                        // Garbage cell without explicit piece type; mark as garbage/occupied
                        cellValue = "G";
                    } else {
                        // Fallback occupied cell
                        cellValue = null;
                    }
                }

                row.push(cellValue);
            }
            board.push(row);
        }
        
        return board;
    }

    convertPieceType(tetiPiece) {
        // Map TETI piece representation to standard piece letters
        const pieceMap = {
            'I': 'I', 'O': 'O', 'T': 'T', 'S': 'S', 'Z': 'Z', 'J': 'J', 'L': 'L',
            'i': 'I', 'o': 'O', 't': 'T', 's': 'S', 'z': 'Z', 'j': 'J', 'l': 'L'
        };
        
        if (typeof tetiPiece === 'string') {
            return pieceMap[tetiPiece] || tetiPiece.toUpperCase();
        } else if (tetiPiece && tetiPiece.type) {
            return pieceMap[tetiPiece.type] || tetiPiece.type.toUpperCase();
        }
        
        return null;
    }

    getQueueArray() {
        const queue = [];
        
        // Get current piece
        if (Game.falling.piece && Game.falling.piece.name) {
            queue.push(Game.falling.piece.name.toUpperCase());
        }
        
        // Get next pieces from bag
        if (Game.bag && Game.bag.getFirstN) {
            const nextPieces = Game.bag.getFirstN(6);
            nextPieces.forEach(piece => {
                if (piece && piece.name) {
                    queue.push(piece.name.toUpperCase());
                }
            });
        }
        
        // Ensure we have at least 6 pieces
        const pieceTypes = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
        while (queue.length < 6) {
            queue.push(pieceTypes[Math.floor(Math.random() * pieceTypes.length)]);
        }
        
        return queue.slice(0, 6); // Limit to 6 pieces
    }

    getHoldPiece() {
        if (Game.hold && Game.hold.piece && Game.hold.piece.name) {
            return Game.hold.piece.name.toUpperCase();
        }
        return null;
    }

    executeMoves() {
        if (!this.isActive || this.currentMoves.length === 0) return;
        
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
        }
        
        this.autoPlayInterval = setInterval(() => {
            if (this.moveIndex >= this.currentMoves.length || !this.isActive) {
                clearInterval(this.autoPlayInterval);
                this.autoPlayInterval = null;
                
                // In loop mode, request next suggestion. In singleRun, stop.
                if (this.isActive && !Game.ended && !this.singleRun) {
                    setTimeout(() => {
                        this.sendGameState();
                        this.requestSuggestion();
                    }, 100);
                } else if (this.singleRun) {
                    // reset flags so next click will run once again
                    this.singleRun = false;
                    this.isActive = false;
                    this.stopBot();
                }
                return;
            }
            
            const move = this.currentMoves[this.moveIndex];
            this.executeMove(move);
            this.moveIndex++;
        }, this.autoPlayDelay);
    }

    executeMove(move) {
        if (!move || !move.location) return;
        
        try {
            const { location, spin } = move;
            const { x, y, orientation, type } = location;
            
            // Convert orientation to TETI format
            let targetRotation = 0;
            switch (orientation) {
                case 'north': targetRotation = 0; break;
                case 'east': targetRotation = 1; break;
                case 'south': targetRotation = 2; break;
                case 'west': targetRotation = 3; break;
            }
            
            // Execute the move by simulating key presses
            this.simulateMovement(x, y, targetRotation, spin);
            
        } catch (error) {
            console.error('Error executing move:', error);
        }
    }

    simulateMovement(targetX, targetY, targetRotation, spin) {
        if (!Game.falling.piece || !this.isActive) return;
        
        // Get current piece position
        const currentX = Game.falling.location[0];
        const currentY = Game.falling.location[1];
        const currentRotation = Game.falling.rotation;
        
        // Rotate to target orientation
        const rotationDiff = (targetRotation - currentRotation + 4) % 4;
        for (let i = 0; i < rotationDiff; i++) {
            Game.movement.rotate("CW"); // Rotate clockwise
        }
        
        // Move horizontally
        const horizontalDiff = targetX - currentX;
        if (horizontalDiff > 0) {
            for (let i = 0; i < horizontalDiff; i++) {
                Game.movement.movePieceSide("RIGHT", 1);
            }
        } else if (horizontalDiff < 0) {
            for (let i = 0; i < Math.abs(horizontalDiff); i++) {
                Game.movement.movePieceSide("LEFT", 1);
            }
        }
        
        // Handle spin moves (T-spins, etc.)
        if (spin && spin !== 'none') {
            // Additional rotation for spins might be needed
            // This depends on the specific implementation
        }
        
        // Drop the piece
        Game.movement.harddrop();
    }

    // Called when game state changes (new piece, line clear, etc.)
    onGameStateChange() {
        if (this.isActive && !this.pendingSuggestion && this.autoPlayInterval === null) {
            setTimeout(() => {
                this.sendGameState();
                this.requestSuggestion();
            }, 200);
        }
    }

    // Called when game ends
    onGameEnd() {
        this.stopBot();
    }

    // Called when game starts
    onGameStart() {
        // No-op for single-shot mode; show/hide in-game button here
        const btn = document.getElementById('misamino-ingame');
        if (btn) btn.style.display = (Game.settings.game.gamemode === 'custom') ? 'block' : 'none';
    }

    destroy() {
        this.stopBot();
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.isInitialized = false;
    }
}