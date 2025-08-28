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
        this.autoPlayDelay = 1000; // 1000ms (1 second) between pieces
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
        
        // Create a test board with some pieces at the bottom
        const testBoard = Array(40).fill(null).map(() => Array(10).fill(null));
        
        // Add some test pieces at the bottom
        testBoard[0][0] = 'I'; // Bottom left
        testBoard[0][1] = 'T';
        testBoard[0][2] = 'L';
        testBoard[1][0] = 'S';
        testBoard[1][1] = 'Z';
        
        const testGameState = {
            type: "start",
            hold: null,
            queue: ["I", "T", "L", "O", "S", "Z"],
            combo: 0,
            back_to_back: false,
            board: testBoard
        };
        
        console.log('Sending test game state:', testGameState);
        this.worker.postMessage(testGameState);
        
        // Request a test suggestion
        setTimeout(() => {
            console.log('Requesting test suggestion...');
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
        
        // Small delay to ensure game is ready
        setTimeout(() => {
            if (this.isActive && Game.falling.piece) {
                console.log('Bot ready, sending initial game state');
                this.sendGameState();
                this.requestSuggestion();
            }
        }, 500);
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

        // Debug: Check raw board state
        this.debugBoardState();
        
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
    
    debugBoardState() {
        console.log('=== TETI Board State Debug ===');
        
        // Check for solid pieces
        const solidMinos = Game.board.getMinos("S");
        console.log('Solid pieces found:', solidMinos.length);
        
        // Sample some board cells
        for (let y = 0; y < Math.min(10, Game.board.boardState.length); y++) {
            for (let x = 0; x < Game.board.boardState[y].length; x++) {
                const cell = Game.board.boardState[y][x];
                if (cell && cell.trim() !== "") {
                    console.log(`Cell [${x},${y}]: "${cell}"`);
                }
            }
        }
        
        // Check current piece info
        if (Game.falling.piece) {
            console.log('Current piece:', {
                name: Game.falling.piece.name,
                location: Game.falling.location,
                rotation: Game.falling.rotation
            });
        }
        
        console.log('=== End Debug ===');
    }

    requestSuggestion() {
        if (!this.worker || !this.isActive || this.pendingSuggestion) return;
        
        this.pendingSuggestion = true;
        this.worker.postMessage({ type: "suggest" });
    }

    convertBoardToTBPFormat() {
        const board = [];
        
        // TBP format: 40 rows × 10 columns
        // Standard Tetris: row 0 = bottom, row 39 = top
        // We need to convert TETI's board format to TBP format
        
        for (let y = 0; y < 40; y++) {
            const row = [];
            for (let x = 0; x < 10; x++) {
                let cellValue = null;
                
                // Check if this position has a solid piece in TETI
                if (y < Game.board.boardState.length && 
                    x < Game.board.boardState[y].length && 
                    Game.board.boardState[y][x]) {
                    
                    const cellContents = Game.board.boardState[y][x];
                    
                    // Parse TETI's cell format
                    if (cellContents.includes('S')) {
                        // Look for pattern like "S i", "S t", etc.
                        const parts = cellContents.split(' ').filter(p => p.length > 0);
                        
                        for (let i = 0; i < parts.length; i++) {
                            if (parts[i] === 'S' && i + 1 < parts.length) {
                                const pieceType = parts[i + 1];
                                cellValue = this.convertPieceType(pieceType);
                                break;
                            }
                        }
                        
                        // If no piece type found after S, try other patterns
                        if (!cellValue) {
                            for (const part of parts) {
                                if (part !== 'S' && part.length === 1) {
                                    const converted = this.convertPieceType(part);
                                    if (converted) {
                                        cellValue = converted;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                
                row.push(cellValue);
            }
            board.push(row);
        }
        
        // Debug output with more details
        const filledRows = board.filter(row => row.some(cell => cell !== null)).length;
        const totalPieces = board.flat().filter(cell => cell !== null).length;
        console.log(`Board conversion: ${filledRows} filled rows, ${totalPieces} total pieces`);
        
        if (filledRows > 0) {
            console.log('Sample board data:');
            for (let y = 0; y < Math.min(5, board.length); y++) {
                const row = board[y];
                if (row.some(cell => cell !== null)) {
                    console.log(`Row ${y}:`, row);
                }
            }
        }
        
        return board;
    }

    convertPieceType(tetiPiece) {
        if (!tetiPiece) return null;
        
        // Map TETI piece representation to TBP standard piece letters
        const pieceMap = {
            'I': 'I', 'O': 'O', 'T': 'T', 'S': 'S', 'Z': 'Z', 'J': 'J', 'L': 'L',
            'i': 'I', 'o': 'O', 't': 'T', 's': 'S', 'z': 'Z', 'j': 'J', 'l': 'L'
        };
        
        if (typeof tetiPiece === 'string') {
            const mapped = pieceMap[tetiPiece.trim()];
            if (mapped) return mapped;
            
            // Try uppercase conversion as fallback
            const upper = tetiPiece.trim().toUpperCase();
            if (['I', 'O', 'T', 'S', 'Z', 'J', 'L'].includes(upper)) {
                return upper;
            }
        } else if (tetiPiece && tetiPiece.type) {
            return this.convertPieceType(tetiPiece.type);
        }
        
        console.warn('Unknown piece type:', tetiPiece);
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
            this.autoPlayInterval = null;
        }
        
        console.log(`Executing ${this.currentMoves.length} moves for current piece`);
        
        // Execute the moves with proper delay
        if (this.currentMoves.length > 0) {
            // Use setTimeout to add delay before executing the move
            setTimeout(() => {
                if (this.isActive && this.currentMoves.length > 0) {
                    const move = this.currentMoves[0];
                    this.executeMove(move);
                    
                    // Clear the moves array since we've processed them
                    this.currentMoves = [];
                    this.moveIndex = 0;
                }
            }, 200); // Small delay to ensure piece is fully spawned
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
            console.log('Game state changed, scheduling next move in 1 second');
            
            // Wait 1 second before processing the next piece (1 piece per second)
            setTimeout(() => {
                if (this.isActive && Game.falling.piece && !this.pendingSuggestion) {
                    console.log('Processing next piece after 1 second delay');
                    this.sendGameState();
                    this.requestSuggestion();
                }
            }, this.autoPlayDelay); // 1 second delay
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