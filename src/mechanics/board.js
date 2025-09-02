import { Game } from "../main.js";

export class Board {
    /**
     * @type {string[][]}
     */
    boardState = [];

    // Check if a cell contains a specific value
    checkMino([x, y], val) {
        return this.boardState[y][x].split(" ").includes(val);
    }

    // Remove all minos with a specific value from the board
    MinoToNone(val) {
        this.getMinos(val).forEach(([x, y]) => this.rmValue([x, y], val));
    }

    // Remove all cells containing a specific value from the board
    EradicateMinoCells(val) {
        this.getCoords(this.boardState, c => c.includes(val), [0, 0]).forEach(([x, y]) => this.rmValue([x, y], val));
    }

    // Add minos with a value at given coordinates, with offset
    addMinos(val, c, [dx, dy]) {
        c.forEach(([x, y]) => this.setValue([x + dx, y + dy], val));
    }

    // Add a value to the front of a cell
    addValFront([x, y], val) {
        this.boardState[y][x] = `${val} ${this.boardState[y][x]}`;
    }

    // Add a value to a cell
    addValue([x, y], val) {
        this.boardState[y][x] = (this.boardState[y][x] + " " + val).trim();
    }

    // Set a cell to a specific value
    setValue([x, y], val) {
        this.boardState[y][x] = val;
    }

    // Remove a value from a cell
    rmValue([x, y], val) {
        this.boardState[y][x] = this.boardState[y][x].replace(val, "").trim();
    }

    // Get all board coordinates containing a specific mino name
    getMinos(name) {
        return this.getCoords(this.boardState, c => c.split(" ").includes(name), [0, 0]);
    }

    // Convert a piece matrix to board coordinates, with offset
    pieceToCoords(arr, [dx, dy] = [0, 0]) {
        return this.getCoords(arr.toReversed(), c => c == 1, [dx, dy]);
    }

    // Set a cell to empty
    setCoordEmpty([x, y]) {
        this.boardState[y][x] = "";
    }

    // Reset board to empty state
    resetBoard() {
        this.boardState = [...Array(40)].map(() => [...Array(10)].map(() => ""));
    }

    // Get all full rows (for line clear)
    getFullRows() {
        const rows = this.getMinos("S")
            .map(coord => coord[1])
            .reduce((prev, curr) => ((prev[curr] = ++prev[curr] || 1), prev), {});
        return Object.keys(rows)
            .filter(key => rows[key] >= 10)
            .map(row => +row)
            .toReversed();
    }

    // Utility: get coordinates matching a filter in an array
    getCoords(array, filter, [dx, dy]) {
        const coords = [];
        array.forEach((row, y) =>
            row.forEach((col, x) => {
                if (filter(col)) coords.push([x + dx, y + dy]);
            })
        );
        return coords;
    }

    // Move minos in a direction
    moveMinos(coords, dir, size, value = "") {
        const getChange = ([x, y], a) => {
            return { RIGHT: [x + a, y], LEFT: [x - a, y], DOWN: [x, y - a], UP: [x, y + a] };
        };
        const newcoords = coords.map(c => getChange(c, size)[dir]);

        if (newcoords.some(([x, y]) => y > 39)) {
            Game.endGame("Topout");
            return;
        }

        const valTable = coords.map(([x, y]) => (value ? value : this.boardState[y][x]));
        coords.forEach((c, idx) => this.rmValue(c, valTable[idx]));

        newcoords.forEach((c, idx) =>
            value ? this.addValue(c, valTable[idx]) : this.setValue(c, valTable[idx])
        );
        Game.mechanics.spawnOverlay();
    }

    // Set up combo board (for special patterns)
    setComboBoard(start) {
        // 4w sides
        const board = JSON.parse(JSON.stringify(this.boardState));          
        board.forEach((row, y) => {
            row.forEach((col, x) => {
                if ((x > 2 && x < 7) || y > 30) return;
                this.setValue([x, y], 'S G')
            })
        })

        if (!start) return;
        // garbage pattern
        const validCoords = [[[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 1], [1, 1], [2, 1], [3, 1]]];
        const garbAmount = Math.random() > 0.5 ? 3 : 6;
        const garbCoords = [];
        for (let i = 0; i < garbAmount; i++) {
            const y = Math.random() > 0.5 ? 0 : 1;
            if (validCoords[y].length == 1) { i--; continue; }
            const coord = validCoords[y].splice(Math.floor(Math.random() * validCoords[y].length), 1);
            garbCoords.push(coord[0]);
        }

        this.addMinos("S G", garbCoords.map(([x, y]) => [x + 3, y]), [0, 0]);
        Game.mechanics.setShadow();
    }

    // --- NEW: Teleport the falling piece to (x, y) with the given rotation ---
    // This is used by the bot to place the piece at the exact TBP-recommended spot.
    teleportFallingPiece(piece, x, y, rotation) {
        // Remove all currently placed minos for the falling piece (marked as "A <piece>")
        this.MinoToNone("A " + piece.name);

        // Get the piece's shape matrix for the specified rotation
        const shape = piece[`shape${rotation}`];

        // Convert the shape matrix to board coordinates (relative to origin 0,0)
        const coords = this.pieceToCoords(shape);

        // Add the piece's minos at the new position (offset by x, y)
        this.addMinos("A " + piece.name, coords, [x, y]);
    }
}