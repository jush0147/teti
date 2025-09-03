# SRS Offset Calculations

This document details the calculation of SRS offsets for each piece in the `teti` game.
The offset is the vector from the top-left of the piece's bounding box matrix (defined in `src/data/pieces.js`) to its SRS rotation center.
The rotation center is determined by the "true rotation" diagram from the Hard Drop wiki and the TBP specification.
The coordinate system is `[x, y]`, with `y` increasing downwards.

---

## J, L, S, T, Z - Pieces

For all of these pieces, the shapes are defined in a 3x3 matrix. The SRS rotation center is the central mino of the piece's main body. In all rotation shapes (`shape0` through `shape3`) for these pieces as defined in `src/data/pieces.js`, this central pivot mino is located at the matrix coordinate `(1,1)`.

Therefore, the offset for all these pieces in all orientations is **`[1, 1]`**.

---

## O-Piece

The O-piece uses a single shape `[[1,1],[1,1]]` for all rotations. The TBP spec defines the rotation center based on the orientation.

- **north:** Center is the bottom-left mino at `(0,1)`. **Offset: `[0, 1]`**
- **east:** Center is the top-left mino at `(0,0)`. **Offset: `[0, 0]`**
- **south:** Center is the top-right mino at `(1,0)`. **Offset: `[1, 0]`**
- **west:** Center is the bottom-right mino at `(1,1)`. **Offset: `[1, 1]`**

---

## I-Piece

The I-piece is defined in a 4x4 matrix. The TBP spec defines the center based on orientation.

- **shape0 (north):** `[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]]`
  - TBP center is the "middle-left" mino, which is at `(1,1)`.
  - **Offset: `[1, 1]`**

- **shape1 (east):** `[[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]]`
  - TBP center is the "middle-top" mino, which is at `(2,1)`.
  - **Offset: `[2, 1]`**

- **shape2 (south):** `[[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]]`
  - TBP center is the "middle-right" mino, which is at `(2,2)`.
  - **Offset: `[2, 2]`**

- **shape3 (west):** `[[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]`
  - TBP center is the "middle-bottom" mino, which is at `(1,2)`.
  - **Offset: `[1, 2]`**
