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
        if (Game.ended) {
            Game.modals.generate.notif("MisaMino", "Game has ended", "error");
            return;
        }

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

    // Convert TBP coordinates to TETI coordinates
    convertTBPToTETICoordinates(tbpX, tbpY) {
        // Both systems use bottom-left origin with y increasing upward
        // But let's add some debugging and potential adjustments
        
        // Debug: log the conversion
        console.log(`TBP coordinates: (${tbpX}, ${tbpY})`);
        
        // For now, assume they're the same coordinate system
        // But we can add adjustments here if needed
        let tetiX = tbpX;
        let tetiY = tbpY;
        
        // Validate coordinates are within bounds
        if (tetiX < 0 || tetiX >= 10) {
            console.warn(`X coordinate ${tetiX} out of bounds, clamping to [0, 9]`);
            tetiX = Math.max(0, Math.min(9, tetiX));
        }
        
        if (tetiY < 0 || tetiY >= 40) {
            console.warn(`Y coordinate ${tetiY} out of bounds, clamping to [0, 39]`);
            tetiY = Math.max(0, Math.min(39, tetiY));
        }
        
        console.log(`Converted to TETI: (${tetiX}, ${tetiY})`);
        console.log(`Current piece position: [${Game.falling.location[0]}, ${Game.falling.location[1]}]`);
        
        return [tetiX, tetiY];
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
        if (!this.isActive || this.currentMoves.length === 0 || Game.ended) return;
        
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
        }
        
        this.autoPlayInterval = setInterval(() => {
            if (this.moveIndex >= this.currentMoves.length || !this.isActive || Game.ended) {
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
            
            // Convert TBP coordinates to TETI coordinates (use both X and Y)
            const [tetiX, tetiY] = this.convertTBPToTETICoordinates(x, y);

            // If the bot's target piece type is different from the current active piece, try holding once
            const botPiece = (type ?? '').toString().toUpperCase();
            const currentPiece = (Game.falling && Game.falling.piece && Game.falling.piece.name)
                ? Game.falling.piece.name.toUpperCase()
                : '';
            if (botPiece && currentPiece && botPiece !== currentPiece && !Game.ended) {
                if (Game.mechanics && typeof Game.mechanics.switchHold === 'function') {
                    Game.mechanics.switchHold();
                }
            }
            
            // Convert orientation to TETI format
            let targetRotation = 0;
            switch (orientation) {
                case 'north': targetRotation = 0; break;
                case 'east': targetRotation = 1; break;
                case 'south': targetRotation = 2; break;
                case 'west': targetRotation = 3; break;
            }
            
            // Rotate first using engine kicks, then directly place at (x,y), then hard drop
            this.directPlaceAndDrop(tetiX, tetiY, targetRotation);
            
        } catch (error) {
            console.error('Error executing move:', error);
        }
    }

    directPlaceAndDrop(targetX, targetY, targetRotation) {
        if (!Game.falling.piece || Game.ended) return;
        
        try {
            // 1) Rotate to the desired orientation using engine (respects kicks)
            const currentRot = Game.falling.rotation;
            const diff = (targetRotation - currentRot + 4) % 4;
            if (diff === 1) Game.movement.rotate("CW");
            else if (diff === 2) Game.movement.rotate("180");
            else if (diff === 3) Game.movement.rotate("CCW");

            // 2) Remove current A/Sh and directly set location & rotation
            Game.board.MinoToNone("A");
            Game.board.MinoToNone("Sh");
            Game.falling.rotation = targetRotation;
            
            // Clamp into board range
            let x = Math.max(0, Math.min(9, targetX));
            let y = Math.max(0, Math.min(39, targetY));

            // 3) Add piece at exact (x,y) using shape coordinates
            const coords = Game.board.pieceToCoords(Game.falling.piece[`shape${targetRotation}`]);
            Game.board.addMinos("A " + Game.falling.piece.name, coords, [x, y]);
            Game.falling.location = [x, y];
            if (Game.pixi && typeof Game.pixi.setRotationCenterPos === 'function') {
                Game.pixi.setRotationCenterPos([x, y], Game.falling.piece.name);
            }

            // 4) Hard drop to lock using standard engine logic
            if (Game.movement && typeof Game.movement.harddrop === 'function') {
                Game.movement.harddrop();
            }
        } catch (err) {
            console.error('directPlaceAndDrop error:', err);
            this.stopBot();
        }
    }

    setPiecePosition(targetX, targetY, targetRotation, spin) {
        if (!Game.falling.piece || !this.isActive || Game.ended) return;
        
        try {
            // Remove current piece from board
            Game.board.MinoToNone("A");
            Game.board.MinoToNone("Sh");
            
            // Set rotation first to compute coords
            Game.falling.rotation = targetRotation;
            const pieceCoordsAtOrigin = Game.board.pieceToCoords(Game.falling.piece[`shape${targetRotation}`]);

            // Compute a safe Y at the given X by moving down until collision
            // Start from a reasonable top Y to avoid out-of-bounds
            let y = Math.min(Math.max(targetY, 0), 39);
            const coordsAtX = (yy) => pieceCoordsAtOrigin.map(([px, py]) => [px + targetX, py + yy]);
            // Clamp inside bounds horizontally
            if (coordsAtX(y).some(([x]) => x < 0 || x > 9)) {
                // If out of bounds, clamp X by shifting
                const minX = Math.min(...coordsAtX(y).map(([x]) => x));
                const maxX = Math.max(...coordsAtX(y).map(([x]) => x));
                const shiftLeft = minX < 0 ? -minX : 0;
                const shiftRight = maxX > 9 ? 9 - maxX : 0;
                const shift = shiftLeft !== 0 ? shiftLeft : shiftRight;
                targetX += shift;
            }

            // Drop Y until just above collision with solids
            while (y > 0 && !Game.movement.checkCollision(coordsAtX(y), "DOWN")) {
                y--;
            }
            // If we're inside collision at given Y, move up until free (safety)
            while (y < 39 && Game.movement.checkCollision(coordsAtX(y), "SPAWN")) {
                y++;
            }

            // Update falling piece location
            Game.falling.location = [targetX, y];
            
            // Place A minos at the computed location
            Game.board.addMinos("A " + Game.falling.piece.name, pieceCoordsAtOrigin, [targetX, y]);
            
            // Update PIXI rotation center (with safety check)
            if (Game.pixi && typeof Game.pixi.setRotationCenterPos === 'function') {
                Game.pixi.setRotationCenterPos([targetX, y], Game.falling.piece.name);
            }
            
            // Hard drop to lock the piece using engine logic (respects collisions)
            if (Game.movement && typeof Game.movement.harddrop === 'function') {
                Game.movement.harddrop();
            }
        } catch (error) {
            console.error('Error in setPiecePosition:', error);
            this.stopBot();
        }
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