# MisaMino Bot 速度和邏輯修正

## 🐛 問題描述

用戶報告了兩個主要問題：
1. **Bot邏輯異常**: Bot沒有使用正常邏輯操作方塊
2. **放置速度過快**: 需要調整為每秒一個方塊的速度

## 🔧 修正內容

### 1. 速度控制修正

#### 修正前問題：
- 方塊放置速度過快，沒有適當的延遲
- `autoPlayDelay = 500ms` 太快

#### 修正後：
```javascript
// 調整為每秒一個方塊
this.autoPlayDelay = 1000; // 1000ms (1 second) between pieces

// 在 onGameStateChange 中實現正確的延遲
onGameStateChange() {
    if (this.isActive && !this.pendingSuggestion) {
        console.log('Game state changed, scheduling next move in 1 second');
        
        // 等待1秒後處理下一個方塊 (每秒1個方塊)
        setTimeout(() => {
            if (this.isActive && Game.falling.piece && !this.pendingSuggestion) {
                console.log('Processing next piece after 1 second delay');
                this.sendGameState();
                this.requestSuggestion();
            }
        }, this.autoPlayDelay); // 1秒延遲
    }
}
```

### 2. Bot邏輯修正

#### A. 改善Board State轉換

**修正前問題**：
- Board state解析不正確
- 無法正確識別TETI的方塊格式

**修正後**：
```javascript
convertBoardToTBPFormat() {
    // 更準確的TETI格式解析
    if (cellContents.includes('S')) {
        const parts = cellContents.split(' ').filter(p => p.length > 0);
        
        // 尋找 "S piecetype" 模式
        for (let i = 0; i < parts.length; i++) {
            if (parts[i] === 'S' && i + 1 < parts.length) {
                const pieceType = parts[i + 1];
                cellValue = this.convertPieceType(pieceType);
                break;
            }
        }
    }
}
```

#### B. 增強調試功能

**新增debugBoardState()方法**：
```javascript
debugBoardState() {
    console.log('=== TETI Board State Debug ===');
    
    // 檢查solid pieces
    const solidMinos = Game.board.getMinos("S");
    console.log('Solid pieces found:', solidMinos.length);
    
    // 檢查board cells內容
    for (let y = 0; y < Math.min(10, Game.board.boardState.length); y++) {
        for (let x = 0; x < Game.board.boardState[y].length; x++) {
            const cell = Game.board.boardState[y][x];
            if (cell && cell.trim() !== "") {
                console.log(`Cell [${x},${y}]: "${cell}"`);
            }
        }
    }
    
    // 檢查當前方塊資訊
    if (Game.falling.piece) {
        console.log('Current piece:', {
            name: Game.falling.piece.name,
            location: Game.falling.location,
            rotation: Game.falling.rotation
        });
    }
}
```

#### C. 改善移動執行

**修正executeMoves()方法**：
```javascript
executeMoves() {
    if (!this.isActive || this.currentMoves.length === 0) return;
    
    console.log(`Executing ${this.currentMoves.length} moves for current piece`);
    
    // 添加小延遲確保方塊完全生成
    if (this.currentMoves.length > 0) {
        setTimeout(() => {
            if (this.isActive && this.currentMoves.length > 0) {
                const move = this.currentMoves[0];
                this.executeMove(move);
                
                // 清除已處理的移動
                this.currentMoves = [];
                this.moveIndex = 0;
            }
        }, 200); // 小延遲確保方塊完全生成
    }
}
```

#### D. 優化startBot()方法

**添加初始化延遲**：
```javascript
startBot() {
    if (!this.worker || Game.ended) return;
    
    console.log('Starting MisaMino bot...');
    
    // 小延遲確保遊戲準備就緒
    setTimeout(() => {
        if (this.isActive && Game.falling.piece) {
            console.log('Bot ready, sending initial game state');
            this.sendGameState();
            this.requestSuggestion();
        }
    }, 500);
}
```

### 3. 改善的測試功能

**更好的worker測試**：
```javascript
testWorker() {
    // 創建帶有測試方塊的board
    const testBoard = Array(40).fill(null).map(() => Array(10).fill(null));
    
    // 在底部添加測試方塊
    testBoard[0][0] = 'I'; // 左下角
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
    
    this.worker.postMessage(testGameState);
    
    setTimeout(() => {
        this.worker.postMessage({ type: "suggest" });
    }, 500);
}
```

## 🔍 調試功能

### 新增的調試日誌：

1. **Board State調試**:
   ```
   === TETI Board State Debug ===
   Solid pieces found: X
   Cell [x,y]: "S piecetype"
   Current piece: {name, location, rotation}
   === End Debug ===
   ```

2. **Board轉換調試**:
   ```
   Board conversion: X filled rows, Y total pieces
   Sample board data:
   Row 0: [null, null, "I", null, ...]
   ```

3. **速度控制調試**:
   ```
   Game state changed, scheduling next move in 1 second
   Processing next piece after 1 second delay
   ```

4. **移動執行調試**:
   ```
   Executing 1 moves for current piece
   Executing move: {location: {x, y, orientation}, spin}
   ```

## 🎯 預期效果

### 速度控制：
- ✅ 每秒放置一個方塊
- ✅ 適當的延遲確保方塊完全生成
- ✅ 不會過快執行導致錯誤

### Bot邏輯：
- ✅ 正確解析TETI board狀態
- ✅ 準確傳送遊戲資訊給MisaMino
- ✅ 詳細的調試資訊幫助診斷問題
- ✅ 更穩定的初始化流程

## 🧪 測試步驟

1. **開啟瀏覽器開發者工具** (F12)
2. **切換到Zen/Custom模式**
3. **點擊BOT按鈕啟動bot**
4. **觀察Console日誌**，應該看到：
   ```
   Testing MisaMino worker...
   Sending test game state: {...}
   Requesting test suggestion...
   Received message from MisaMino: {...}
   Starting MisaMino bot...
   === TETI Board State Debug ===
   ...
   Bot ready, sending initial game state
   Game state changed, scheduling next move in 1 second
   Processing next piece after 1 second delay
   ```

5. **確認速度**: 觀察方塊放置間隔約為1秒
6. **確認邏輯**: Bot應該做出合理的移動決策

## 📝 已知改善

- **穩定的速度控制**: 每秒一個方塊的節奏
- **更好的錯誤處理**: 避免在方塊未完全生成時執行移動
- **詳細的調試資訊**: 幫助診斷任何剩餘問題
- **改善的board格式轉換**: 更準確地解析TETI的資料格式

現在MisaMino bot應該以正確的速度運行，並使用更合理的邏輯來操作方塊！