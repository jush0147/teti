import { Game } from "../main.js";

export class MobileControls {
    constructor() {
        this.isInitialized = false;
        this.touchStartTime = {};
        this.repeatIntervals = {};
        this.isMobile = this.detectMobile();
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               window.innerWidth <= 768;
    }

    init() {
        if (this.isInitialized || !this.isMobile) return;
        
        this.setupTouchControls();
        this.isInitialized = true;
        console.log('Mobile controls initialized');
    }

    setupTouchControls() {
        const controlButtons = document.querySelectorAll('.control-btn');
        
        controlButtons.forEach(button => {
            const action = button.getAttribute('data-action');
            
            // Touch events for mobile
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handleTouchStart(action, button);
            });
            
            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.handleTouchEnd(action, button);
            });
            
            // Mouse events for testing on desktop
            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.handleTouchStart(action, button);
            });
            
            button.addEventListener('mouseup', (e) => {
                e.preventDefault();
                this.handleTouchEnd(action, button);
            });
            
            // Prevent context menu on long press
            button.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });
        });
    }

    handleTouchStart(action, button) {
        if (Game.ended || !Game.started) return;
        
        // Prevent action if bot is active
        if (Game.misamino && Game.misamino.isActive) {
            Game.modals.generate.notif("Controls", "Disable bot to use manual controls", "warning");
            return;
        }
        
        this.touchStartTime[action] = Date.now();
        button.classList.add('pressed');
        
        // Haptic feedback if supported
        this.triggerHapticFeedback(action);
        
        // Execute the action immediately
        this.executeAction(action);
        
        // Set up repeat for continuous actions
        if (this.isContinuousAction(action)) {
            this.repeatIntervals[action] = setInterval(() => {
                this.executeAction(action);
            }, this.getRepeatDelay(action));
        }
    }

    handleTouchEnd(action, button) {
        button.classList.remove('pressed');
        
        // Clear repeat interval
        if (this.repeatIntervals[action]) {
            clearInterval(this.repeatIntervals[action]);
            delete this.repeatIntervals[action];
        }
        
        delete this.touchStartTime[action];
    }

    executeAction(action) {
        if (Game.ended || !Game.started) return;
        
        try {
            switch (action) {
                case 'left':
                    Game.movement.movePieceSide("LEFT", 1);
                    break;
                    
                case 'right':
                    Game.movement.movePieceSide("RIGHT", 1);
                    break;
                    
                case 'soft-drop':
                    Game.movement.movePieceDown(false);
                    break;
                    
                case 'hard-drop':
                    Game.movement.harddrop();
                    break;
                    
                case 'rotate-cw':
                    Game.movement.rotate("CW");
                    break;
                    
                case 'rotate-ccw':
                    Game.movement.rotate("CCW");
                    break;
                    
                case 'rotate-180':
                    // 180 rotation = 2 clockwise rotations
                    Game.movement.rotate("CW");
                    setTimeout(() => Game.movement.rotate("CW"), 50);
                    break;
                    
                case 'hold':
                    if (Game.settings.game.allowHold && !Game.hold.occured) {
                        Game.hold.holdPiece();
                    }
                    break;
                    
                default:
                    console.warn(`Unknown action: ${action}`);
            }
        } catch (error) {
            console.error(`Error executing action ${action}:`, error);
        }
    }

    isContinuousAction(action) {
        return ['left', 'right', 'soft-drop'].includes(action);
    }

    getRepeatDelay(action) {
        switch (action) {
            case 'left':
            case 'right':
                return 100; // 10 times per second for horizontal movement
            case 'soft-drop':
                return 50;  // 20 times per second for soft drop
            default:
                return 200;
        }
    }

    // Show/hide controls based on game state
    updateVisibility() {
        const controlsElement = document.getElementById('mobile-controls');
        if (!controlsElement || !this.isMobile) return;
        
        // Hide controls in certain modals or when game is not active
        const shouldHide = Game.modals.open || 
                          document.getElementById('settingsPanel').open ||
                          Game.ended;
                          
        controlsElement.style.display = shouldHide ? 'none' : 'flex';
    }

    // Adjust controls based on screen orientation
    handleOrientationChange() {
        if (!this.isMobile) return;
        
        setTimeout(() => {
            const controlsElement = document.getElementById('mobile-controls');
            if (controlsElement) {
                // Adjust height based on orientation
                const isLandscape = window.innerWidth > window.innerHeight;
                controlsElement.style.height = isLandscape ? '100px' : '120px';
            }
        }, 100);
    }

    triggerHapticFeedback(action) {
        // Light haptic feedback for touch devices
        if (navigator.vibrate && Game.settings && Game.settings.display && Game.settings.display.hapticFeedback !== false) {
            const vibrationPattern = {
                'hard-drop': 100,
                'rotate-cw': 50,
                'rotate-ccw': 50,
                'rotate-180': 75,
                'hold': 60,
                'left': 30,
                'right': 30,
                'soft-drop': 25
            };
            
            const duration = vibrationPattern[action] || 40;
            navigator.vibrate(duration);
        }
    }

    destroy() {
        // Clean up intervals
        Object.values(this.repeatIntervals).forEach(interval => {
            clearInterval(interval);
        });
        this.repeatIntervals = {};
        this.touchStartTime = {};
        this.isInitialized = false;
    }
}

// Add pressed state CSS
const pressedStyle = document.createElement('style');
pressedStyle.textContent = `
    .control-btn.pressed {
        transform: scale(0.9) !important;
        background: linear-gradient(145deg, #1a1a1a, #2a2a2a) !important;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.4) !important;
    }
`;
document.head.appendChild(pressedStyle);