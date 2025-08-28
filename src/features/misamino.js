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
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Use relative path that works both locally and on GitHub Pages
            const workerPath = new URL('./assets/misamino/misaImport.js', window.location.href).href;
            this.worker = new Worker(workerPath);
            this.worker.onmessage = (e) => this.handleWorkerMessage(e);
            this.worker.onerror = (error) => {
                console.error('MisaMino Worker Error:', error);
                Game.modals.generate.notif("MisaMino Error", "Failed to initialize bot", "error");
            };
            
            // Test the worker with a simple message after a short delay
            setTimeout(() => {
                this.testWorker();
            }, 1000);
            
            this.isInitialized = true;
            console.log('MisaMino bot initialized successfully');
        } catch (error) {
            console.error('Failed to initialize MisaMino bot:', error);
            Game.modals.generate.notif("MisaMino Error", "Failed to load bot files", "error");
        }
    }

    testWorker() {
        if (!this.worker) return;
        
        console.log('Testing MisaMino worker...');
        
        // Send a test game state
        const testGameState = {
            type: "start",
            hold: null,
            queue: ["I", "T", "L", "O", "S", "Z"],
            combo: 0,
            back_to_back: false,
            board: Array(40).fill(null).map(() => Array(10).fill(null))
        };
        
        this.worker.postMessage(testGameState);
        
        // Request a test suggestion
        setTimeout(() => {
            this.worker.postMessage({ type: "suggest" });
        }, 500);
    }

    handleWorkerMessage(e) {
        const data = e.data;
        
        console.log('Received message from MisaMino:', data);
        
        if (data.type === 'suggestion' && this.isActive) {
            this.currentMoves = data.moves || [];
            this.moveIndex = 0;
            this.pendingSuggestion = false;
            
            console.log('MisaMino suggested moves:', this.currentMoves);
            
            if (this.currentMoves.length > 0) {
                this.executeMoves();
            } else {
                console.warn('MisaMino returned no moves');
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

    startBot() {
        if (!this.worker || Game.ended) return;
        
        console.log('Starting MisaMino bot...');
        
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
        
        console.log('Sending game state to MisaMino:', {
            hold: gameState.hold,
            queue: gameState.queue,
            combo: gameState.combo,
            back_to_back: gameState.back_to_back,
            boardHeight: gameState.board.length,
            nonEmptyRows: gameState.board.filter(row => row.some(cell => cell !== null)).length
        });
        
        this.worker.postMessage(gameState);
    }

    requestSuggestion() {
        if (!this.worker || !this.isActive || this.pendingSuggestion) return;
        
        this.pendingSuggestion = true;
        this.worker.postMessage({ type: "suggest" });
    }

    convertBoardToTBPFormat() {
        const board = [];
        
        // TBP format expects 40 rows, 10 columns (bottom to top indexing)
        // TETI board: y=0 is bottom, y=39 is top
        for (let y = 0; y < 40; y++) {
            const row = [];
            for (let x = 0; x < 10; x++) {
                let cellValue = null;
                
                // Check if this position has a solid piece
                if (Game.board.boardState[y] && Game.board.boardState[y][x]) {
                    const cellContents = Game.board.boardState[y][x];
                    
                    // Check for solid pieces (S = solid, placed pieces)
                    if (cellContents.includes('S ')) {
                        // Extract piece type - format is usually "S piecetype"
                        const parts = cellContents.split(' ');
                        const pieceIndex = parts.indexOf('S');
                        if (pieceIndex >= 0 && pieceIndex < parts.length - 1) {
                            const pieceType = parts[pieceIndex + 1];
                            cellValue = this.convertPieceType(pieceType);
                        }
                    }
                }
                
                row.push(cellValue);
            }
            board.push(row);
        }
        
        console.log('Board state for MisaMino:', board.slice(0, 20)); // Debug: show bottom 20 rows
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
        
        // Get current piece (the one being controlled)
        if (Game.falling.piece && Game.falling.piece.name) {
            queue.push(Game.falling.piece.name.toUpperCase());
        }
        
        // Get next pieces from bag (these are the upcoming pieces)
        if (Game.bag && Game.bag.getFirstN) {
            const nextPieces = Game.bag.getFirstN(5); // Get next 5 pieces
            nextPieces.forEach(piece => {
                if (piece && piece.name) {
                    queue.push(piece.name.toUpperCase());
                }
            });
        }
        
        console.log('Queue for MisaMino:', queue); // Debug
        return queue;
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
        
        // Execute all moves immediately for the current piece
        // MisaMino typically returns one optimal move per piece
        if (this.currentMoves.length > 0) {
            console.log(`Executing ${this.currentMoves.length} moves for current piece`);
            
            // Execute the first (and usually only) move
            const move = this.currentMoves[0];
            this.executeMove(move);
            
            // Clear the moves array since we've processed them
            this.currentMoves = [];
            this.moveIndex = 0;
        }
    }

    executeMove(move) {
        if (!move || !move.location) return;
        
        try {
            const { location, spin } = move;
            const { x, y, orientation, type } = location;
            
            console.log('Executing move:', move); // Debug
            
            // Convert orientation to TETI rotation format
            let targetRotation = 0;
            switch (orientation) {
                case 'north': targetRotation = 0; break;
                case 'east': targetRotation = 1; break;
                case 'south': targetRotation = 2; break;
                case 'west': targetRotation = 3; break;
            }
            
            // Execute the move by simulating movements
            this.simulateMovement(x, y, targetRotation, spin);
            
        } catch (error) {
            console.error('Error executing move:', error, move);
        }
    }

    simulateMovement(targetX, targetY, targetRotation, spin) {
        if (!Game.falling.piece || !this.isActive) return;
        
        console.log('Current piece state:', {
            location: Game.falling.location,
            rotation: Game.falling.rotation,
            piece: Game.falling.piece.name
        });
        console.log('Target state:', { x: targetX, y: targetY, rotation: targetRotation, spin });
        
        // Get current piece position
        const currentX = Game.falling.location[0];
        const currentY = Game.falling.location[1];
        const currentRotation = Game.falling.rotation;
        
        // First, rotate to target orientation
        let rotationDiff = (targetRotation - currentRotation + 4) % 4;
        
        // Handle 180 degree rotations more efficiently
        if (rotationDiff === 2) {
            Game.movement.rotate("CW");
            Game.movement.rotate("CW");
        } else {
            for (let i = 0; i < rotationDiff; i++) {
                Game.movement.rotate("CW");
            }
        }
        
        // Then move horizontally to target X position
        const horizontalDiff = targetX - Game.falling.location[0]; // Re-check position after rotation
        if (horizontalDiff > 0) {
            // Move right
            for (let i = 0; i < horizontalDiff; i++) {
                Game.movement.movePieceSide("RIGHT", 1);
            }
        } else if (horizontalDiff < 0) {
            // Move left
            for (let i = 0; i < Math.abs(horizontalDiff); i++) {
                Game.movement.movePieceSide("LEFT", 1);
            }
        }
        
        // Handle T-spins and other special spins
        if (spin && spin !== 'none') {
            console.log('Handling spin:', spin);
            // For T-spins, the bot should already have calculated the correct final position
            // Additional rotation might be needed for some spin types
        }
        
        // Finally, hard drop the piece
        Game.movement.harddrop();
        
        console.log('Move completed. Final position:', Game.falling.location);
    }

    // Called when game state changes (new piece, line clear, etc.)
    onGameStateChange() {
        if (this.isActive && !this.pendingSuggestion) {
            console.log('Game state changed, requesting new suggestion');
            
            // Small delay to ensure the new piece is fully spawned
            setTimeout(() => {
                if (this.isActive && Game.falling.piece) {
                    this.sendGameState();
                    this.requestSuggestion();
                }
            }, 100);
        }
    }

    // Called when game ends
    onGameEnd() {
        this.stopBot();
    }

    // Called when game starts
    onGameStart() {
        if (this.isActive) {
            this.startBot();
        }
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