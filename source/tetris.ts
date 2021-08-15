import rotateMatrix from "rotate-matrix"
import shuffleArray from "array-shuffle"

const ROWS = 20
const HIDDEN_ROWS = 3
const COLUMNS = 10
const L_PIECE_LEFT_SPACE = 2

const createMatrix = (rows: number, columns: number) => Array.from({ length: rows }, () => Array.from({ length: columns }))

const createEmptyPlayfield = (rows = ROWS, columns = COLUMNS) => createMatrix(rows + HIDDEN_ROWS, columns)

function createTetromino(structure: Array<Array<true>>, color: string, columns: number, endRow = structure.length - 1, isl = false) {
	const startX = (columns / 2) - Math.ceil(structure[0].length / 2)
	const startY = HIDDEN_ROWS - endRow - 1

	return {
		x: startX,
		y: startY,
		structure,
		color,
		isl,
		startX,
		startY,
	}
}

type Tetromino = ReturnType<typeof createTetromino>

function * createTetrominoBag(columns = COLUMNS) {
	while (true) {
		yield * shuffleArray([
			createTetromino([
				[, , , ,],
				[true, true, true, true],
				[, , , ,],
				[, , , ,],
			], "cyan", columns, 1, true),
			createTetromino([
				[true, , ,],
				[true, true, true],
				[, , ,],
			], "blue", columns, 1),
			createTetromino([
				[, , true],
				[true, true, true],
				[, , ,],
			], "orange", columns, 1),
			createTetromino([
				[true, true],
				[true, true],
			], "yellow", columns),
			createTetromino([
				[, true, true],
				[true, true, ,],
				[, , ,],
			], "green", columns, 1),
			createTetromino([
				[, true, ,],
				[true, true, true],
				[, , ,],
			], "magenta", columns, 1),
			createTetromino([
				[true, true, ,],
				[, true, true],
				[, , ,],
			], "red", columns, 1),
		])
	}
}

type Rotation = 0 | 1 | 2 | 3

const getNextRotation = (currentRotation: Rotation, rotationAmount = 1): Rotation => (currentRotation + rotationAmount) % 4 as Rotation

const wallKicks = {
	0: {
		1: [
			[0, 0],
			[-1, 0],
			[-1, 1],
			[0, -2],
			[-1, -2],
		],
		3: [
			[0, 0],
			[1, 0],
			[1, 1],
			[0, -2],
			[1, -2],
		],
	},
	1: {
		0: [
			[0, 0],
			[1, 0],
			[1, -1],
			[0, 2],
			[1, 2],
		],
		2: [
			[0, 0],
			[1, 0],
			[1, -1],
			[0, 2],
			[1, 2],
		],
	},
	2: {
		1: [
			[0, 0],
			[-1, 0],
			[-1, 1],
			[0, -2],
			[-1, -2],
		],
		3: [
			[0, 0],
			[1, 0],
			[1, 1],
			[0, -2],
			[1, -2],
		],
	},
	3: {
		2: [
			[0, 0],
			[-1, 0],
			[-1, -1],
			[0, 2],
			[-1, 2],
		],
		0: [
			[0, 0],
			[-1, 0],
			[-1, -1],
			[0, 2],
			[-1, 2],
		],
	},
}

const lWallKicks = {
	0: {
		1: [
			[0, 0],
			[-2, 0],
			[1, 0],
			[-2, -1],
			[1, 2],
		],
		3: [
			[0, 0],
			[-1, 0],
			[2, 0],
			[-1, 2],
			[2, -1],
		],
	},
	1: {
		0: [
			[0, 0],
			[2, 0],
			[-1, 0],
			[2, 1],
			[-1, -2],
		],
		2: [
			[0, 0],
			[-1, 0],
			[2, 0],
			[-1, 2],
			[2, -1],
		],
	},
	2: {
		1: [
			[0, 0],
			[1, 0],
			[-2, 0],
			[1, -2],
			[-2, 1],
		],
		3: [
			[0, 0],
			[2, 0],
			[-1, 0],
			[2, 1],
			[-1, -2],
		],
	},
	3: {
		2: [
			[0, 0],
			[-2, 0],
			[1, 0],
			[-2, -1],
			[1, 2],
		],
		0: [
			[0, 0],
			[1, 0],
			[-2, 0],
			[1, -2],
			[-2, 1],
		],
	},
}

export default class Tetris {
	public isGameOver = false
	public canHold = false
	public isLockDelayActive = false
	public rotation: Rotation = 0
	public linesCleared = 0
	private _holdBox?: Tetromino
	private readonly _playfield = createEmptyPlayfield(this.rows, this.columns) as Array<Array<string | undefined>>
	private readonly tetrominoBag = createTetrominoBag(this.columns)
	private fallingTetromino: Tetromino = this.tetrominoBag.next().value as Tetromino
	constructor(public readonly rows = ROWS, public readonly columns = COLUMNS) {}

	get playfield() {
		const playfield = this._playfield.slice(HIDDEN_ROWS).map(row => [...row])
		// Write the current falling Tetromino to the copied playfield
		for (const [rowIndex, row] of this.fallingTetromino.structure.entries()) {
			for (const [columnIndex, isFilled] of row.entries()) {
				if (this.fallingTetromino.y + rowIndex >= HIDDEN_ROWS && isFilled) {
					playfield[this.fallingTetromino.y + rowIndex - HIDDEN_ROWS][this.fallingTetromino.x + columnIndex] = this.fallingTetromino.color
				}
			}
		}

		return playfield
	}

	get holdBox() {
		return this._holdBox && {
			structure: this._holdBox.structure,
			color: this._holdBox.color,
		}
	}

	drop() {
		if (this.isGameOver) {
			return false
		}

		this.isLockDelayActive &&= this.isAtBottom()

		if (this.isLockDelayActive) {
			this.finalizeFallingTetrominoLocation()
			return true
		}

		this.fallingTetromino.y++

		if (this.isAtBottom()) {
			this.isLockDelayActive = true
		}

		return true
	}

	hardDrop() {
		if (this.isGameOver) {
			return false
		}

		while (!this.isAtBottom()) {
			this.fallingTetromino.y++
		}

		this.finalizeFallingTetrominoLocation()
		return true
	}

	rotate() {
		return this.attemptRotation()
	}

	rotateCounterClockwise() {
		return this.attemptRotation(3)
	}

	moveLeft() {
		if (!this.isValidLocation(this.fallingTetromino.x - 1) || this.isGameOver) {
			return false
		}

		this.fallingTetromino.x--
		return true
	}

	moveRight() {
		if (!this.isValidLocation(this.fallingTetromino.x + 1) || this.isGameOver) {
			return false
		}

		this.fallingTetromino.x++
		return true
	}

	hold() {
		if (!this.canHold || this.isGameOver) {
			return false
		}

		[this._holdBox, this.fallingTetromino] = [this.fallingTetromino, this._holdBox]
		this.fallingTetromino.x = this.fallingTetromino.startX
		this.fallingTetromino.y = this.fallingTetromino.startY
		this.canHold = false

		this.fallingTetromino ||= this.tetrominoBag.next().value as Tetromino

		return true
	}

	private finalizeFallingTetrominoLocation() {
		// Write the current falling Tetromino to the playfield
		for (const [rowIndex, row] of this.fallingTetromino.structure.entries()) {
			for (const [columnIndex, isFilled] of row.entries()) {
				if (isFilled) {
					this._playfield[this.fallingTetromino.y + rowIndex][this.fallingTetromino.x + columnIndex] = this.fallingTetromino.color
					this.isGameOver ||= this.fallingTetromino.y + rowIndex < HIDDEN_ROWS
				}
			}
		}

		// Check for lines
		for (let row = this.fallingTetromino.y + this.fallingTetromino.structure.length - 1; row >= this.fallingTetromino.y; row--) {
			if (this._playfield[row]?.every(color => color)) {
				this.isGameOver = false
				this.linesCleared++
				this._playfield.splice(row, 1)
				this._playfield.unshift(Array.from({ length: this.columns }))
				row++
			}
		}

		if (this.isGameOver) {
			return
		}

		this.fallingTetromino = this.tetrominoBag.next().value as Tetromino
		this.isLockDelayActive = false
		this.canHold = true
		this.rotation = 0
	}

	private isValidLocation(x = this.fallingTetromino.x, y = this.fallingTetromino.y, structure = this.fallingTetromino.structure) {
		if (x < 0 - L_PIECE_LEFT_SPACE || y < 0 || x > this.columns - 1 || y > this.rows + HIDDEN_ROWS - 1) {
			return false
		}

		// Check if the Tetromino would conflict with an already existing cell
		for (const [rowIndex, row] of structure.entries()) {
			for (const [columnIndex, isFilled] of row.entries()) {
				if (isFilled && (!this._playfield[y + rowIndex] || this._playfield[y + rowIndex][x + columnIndex] || x + columnIndex < 0 || x + columnIndex > this.columns - 1)) {
					return false
				}
			}
		}

		return true
	}

	private isAtBottom() {
		// Check if it is possible for the Tetromino to fall further
		return !this.isValidLocation(this.fallingTetromino.x, this.fallingTetromino.y + 1)
	}

	private attemptRotation(rotationAmount: Rotation = 1) {
		if (this.isGameOver) {
			return false
		}

		const simpleRotation = (rotateMatrix as <ValueType>(array: ValueType[][], amount: Rotation) => ValueType[][])(this.fallingTetromino.structure, rotationAmount)
		const nextRotation = getNextRotation(this.rotation, rotationAmount)
		const possibleWallKicks = ((this.fallingTetromino.isl ? lWallKicks : wallKicks)[this.rotation][nextRotation]) as Array<[number, number]>
		// Try every possible wall kick
		for (const [xOffset, yOffset] of possibleWallKicks) {
			if (this.isValidLocation(this.fallingTetromino.x + xOffset, this.fallingTetromino.y + yOffset, simpleRotation)) {
				this.fallingTetromino.structure = simpleRotation
				this.fallingTetromino.x += xOffset
				this.fallingTetromino.y += yOffset
				this.rotation = nextRotation
				return true
			}
		}

		return false
	}
}
