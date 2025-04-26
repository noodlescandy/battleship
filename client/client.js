const ws = new WebSocket('ws://localhost:9576');

const startGameButton = document.getElementById('startGame');
const joinGameButton = document.getElementById('joinGame');
const joinCodeInput = document.getElementById('joinCode');
const messagesDiv = document.getElementById('messages');
const grid = document.getElementById('grid');
const opponentGrid = document.getElementById('opponentGrid');
const submitBoardButton = document.getElementById('submitBoard');
const shipSelect = document.getElementById('shipSelect');
const rowInput = document.getElementById('rowInput');
const colInput = document.getElementById('colInput');
const orientationSelect = document.getElementById('orientationSelect');
const placeShipButton = document.getElementById('placeShipButton');

let gameState = "placing";
let isMyTurn = false;

ws.onopen = () => {
    console.log('Connected to server');
};

ws.onmessage = (event) => {
    console.log('Raw message received:', event.data);

    try {
        const messageData = JSON.parse(event.data);
        console.log('Successfully parsed JSON:', messageData);

        // Handle "updateOwnGrid" messages
        if (messageData && typeof messageData === 'object' && messageData.type === "updateOwnGrid") {
            handleGridUpdate(messageData.data); // Update personal grid
            return; // Prevent further processing
        }

        // Handle "sunkShip" messages
        if (messageData && typeof messageData === 'object' && messageData.type === "sunkShip") {
            handleSunkShip(messageData.data); // Update all cells of the sunk ship
            return; // Prevent further processing
        }

        // Handle updates for the opponent's grid (already implemented)
        if (Array.isArray(messageData)) {
            messageData.forEach((row, i) => {
                row.forEach((cell, j) => {
                    const targetCell = opponentGrid.querySelector(`[data-row="${i}"][data-col="${j}"]`);
                    if (targetCell) {
                        if (cell === 3) {
                            targetCell.classList.remove('guessing');
                            targetCell.classList.add('hit');
                        }
                        if (cell === 2) {
                            targetCell.classList.remove('guessing');
                            targetCell.classList.add('miss');
                        }
                    }
                });
            });
            return; // Prevent further processing
        }

        // If the message is not an object or array, process it as a string
        if (typeof messageData === 'string') {
            console.log('Processing as string message:', messageData);
            processStringMessage(messageData);
            return;
        }

        console.log('Unhandled JSON object:', messageData);

    } catch (e) {
        // If parsing fails, log the error and ignore the message
        console.log('Error parsing message as JSON:', e);
    }
};

function handleGridUpdate(data) {
    const { row, col, status } = data;
    console.log(`Updating your grid at ${row},${col} to ${status}`);

    const targetCell = grid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (targetCell) {
        // Remove old hit/miss classes (if any), to avoid stacking weird states
        targetCell.classList.remove('hit', 'miss');

        if (status === "hit") {
            targetCell.classList.add('hit');
            messagesDiv.textContent = "Your ship was hit!";
        } else if (status === "miss") {
            targetCell.classList.add('miss');
            messagesDiv.textContent = "They missed your ship!";
        }
    } else {
        console.error(`Cell not found at ${row},${col}`);
    }
}

function handleSunkShip(cells) {
    console.log("Marking sunk ship:", cells);

    cells.forEach(({ row, col }) => {
        const targetCell = grid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (targetCell) {
            targetCell.classList.add('hit'); // Mark all parts of the sunk ship as "hit"
        }
    });

    messagesDiv.textContent = "One of your ships was sunk!";
}

function processStringMessage(message) {
    console.log('Processing string message:', message);

    if (message === "game start") {
        messagesDiv.textContent = "Game has started!";
        gameState = "playing";
        grid.style.pointerEvents = "none";
    } else if (message === "your turn") {
        isMyTurn = true;
        messagesDiv.textContent = "It's your turn! Make a move.";
    } else if (message === "waiting for other player") {
        isMyTurn = false;
        messagesDiv.textContent = "Waiting for the other player's move...";
    } else if (message.startsWith("hit ")) {
        const parts = message.split(" ");
        if (parts.length >= 3) {
            const row = parts[1];
            const col = parts[2];
            const targetCell = opponentGrid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (targetCell) {
                targetCell.classList.remove('guessing');
                targetCell.classList.add('hit');
            }
        }
        messagesDiv.textContent = "You hit a ship!";
    } else if (message === "hit (go again)") {
        messagesDiv.textContent = "You hit a ship! Go again.";
    } else if (message.startsWith("miss ")) {
        const parts = message.split(" ");
        if (parts.length >= 3) {
            const row = parts[1];
            const col = parts[2];
            const targetCell = opponentGrid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (targetCell) {
                targetCell.classList.remove('guessing');
                targetCell.classList.add('miss');
            }
        }
        messagesDiv.textContent = "You missed!";
    } else if (message === "miss") {
        messagesDiv.textContent = "You missed!";
    } else if (message === "Sunk a ship!") {
        messagesDiv.textContent = "You sunk a ship!";
    } else if (message === "Opponent sunk one of your ships!") {
        messagesDiv.textContent = "Opponent sunk one of your ships!";
    } else if (message === "You Win!") {
        messagesDiv.textContent = "Congratulations! You won the game!";
        disableGameActions();
    } else if (message === "You Lose!") {
        messagesDiv.textContent = "Game over. You lost.";
        disableGameActions();
    } else if (message === "valid board") {
        messagesDiv.textContent = "Your board has been validated and submitted!";
    } else if (message === "ready for game setup") {
        messagesDiv.textContent = "Both players connected! Set up your ships.";
    } else {
        messagesDiv.textContent = message;
    }
}

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

ws.onclose = () => {
    console.log('Disconnected from server');
};

startGameButton.addEventListener('click', () => {
    ws.send(JSON.stringify('start'));
});

joinGameButton.addEventListener('click', () => {
    const code = joinCodeInput.value.trim();
    if (code) {
        ws.send(JSON.stringify(`join ${code}`));
    } else {
        messagesDiv.textContent = 'Please enter a valid game code.';
    }
});

function highlightCells(row, col, size, orientation, highlightClass) {
    for (let k = 0; k < size; k++) {
        const targetCell = orientation === 'horizontal'
            ? grid.querySelector(`[data-row="${row}"][data-col="${col + k}"]`)
            : grid.querySelector(`[data-row="${row + k}"][data-col="${col}"]`);
        if (targetCell) targetCell.classList.add(highlightClass);
    }
}

function removeHighlight(row, col, size, orientation, highlightClass) {
    for (let k = 0; k < size; k++) {
        const targetCell = orientation === 'horizontal'
            ? grid.querySelector(`[data-row="${row}"][data-col="${col + k}"]`)
            : grid.querySelector(`[data-row="${row + k}"][data-col="${col}"]`);
        if (targetCell) targetCell.classList.remove(highlightClass);
    }
}

rowInput.addEventListener('input', () => previewShipPlacement());
colInput.addEventListener('input', () => previewShipPlacement());
orientationSelect.addEventListener('change', () => previewShipPlacement());
shipSelect.addEventListener('change', () => previewShipPlacement());

function previewShipPlacement() {
    const size = parseInt(shipSelect.value, 10);
    const row = parseInt(rowInput.value, 10);
    const col = parseInt(colInput.value, 10);
    const orientation = orientationSelect.value;

    document.querySelectorAll('.preview').forEach(cell => cell.classList.remove('preview'));

    if (!isNaN(row) && !isNaN(col)) {
        highlightCells(row, col, size, orientation, 'preview');
    }
}

function isAdjacentToShip(row, col) {
    const directions = [
        [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1],
        [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];

    return directions.some(([dx, dy]) => {
        const adjacentCell = grid.querySelector(`[data-row="${row + dx}"][data-col="${col + dy}"]`);
        return adjacentCell && adjacentCell.classList.contains('ship');
    });
}

placeShipButton.addEventListener('click', () => {
    const size = parseInt(shipSelect.value, 10);
    const row = parseInt(rowInput.value, 10);
    const col = parseInt(colInput.value, 10);
    const orientation = orientationSelect.value;

    if (isNaN(row) || isNaN(col) || row < 0 || row > 9 || col < 0 || col > 9) {
        messagesDiv.textContent = 'Invalid row or column. Please enter values between 0 and 9.';
        return;
    }

    if (orientation === 'horizontal' && col + size > 10) {
        messagesDiv.textContent = 'Ship does not fit horizontally!';
        return;
    }
    if (orientation === 'vertical' && row + size > 10) {
        messagesDiv.textContent = 'Ship does not fit vertically!';
        return;
    }

    for (let k = 0; k < size; k++) {
        const targetRow = orientation === 'horizontal' ? row : row + k;
        const targetCol = orientation === 'horizontal' ? col + k : col;

        if (isAdjacentToShip(targetRow, targetCol)) {
            messagesDiv.textContent = 'Ships cannot be adjacent!';
            return;
        }
    }

    for (let k = 0; k < size; k++) {
        const targetRow = orientation === 'horizontal' ? row : row + k;
        const targetCol = orientation === 'horizontal' ? col + k : col;

        const targetCell = grid.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`);
        targetCell.classList.add('ship');
    }

    shipSelect.remove(shipSelect.selectedIndex);
    if (shipSelect.options.length === 0) {
        placeShipButton.disabled = true;
    }

    messagesDiv.textContent = 'Ship placed successfully!';
});

for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
        const cell = document.createElement('div');
        cell.dataset.row = i;
        cell.dataset.col = j;
        grid.appendChild(cell);
    }
}

for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
        const cell = document.createElement('div');
        cell.dataset.row = i;
        cell.dataset.col = j;

        cell.addEventListener('click', () => {
            if (!isMyTurn) {
                messagesDiv.textContent = "It's not your turn!";
                return;
            }
            if (cell.classList.contains('hit') || cell.classList.contains('miss') || cell.classList.contains('guessing')) {
                messagesDiv.textContent = 'You already guessed this cell!';
                return;
            }
            cell.classList.add('guessing');
            ws.send(JSON.stringify(`${i} ${j}`));
            messagesDiv.textContent = 'Guess sent. Waiting for the result...';
        });

        opponentGrid.appendChild(cell);
    }
}

function generateBoard() {
    const board = [];
    for (let i = 0; i < 10; i++) {
        const row = [];
        for (let j = 0; j < 10; j++) {
            const cell = grid.querySelector(`[data-row="${i}"][data-col="${j}"]`);
            row.push(cell.classList.contains('ship') ? 1 : 0);
        }
        board.push(row);
    }
    return board;
}

submitBoardButton.addEventListener('click', () => {
    const board = generateBoard();
    ws.send(JSON.stringify(board));
    messagesDiv.textContent = 'Board submitted. Waiting for the other player...';
});

function disableGameActions() {
    document.querySelectorAll('#opponentGrid div').forEach(cell => {
        cell.style.pointerEvents = 'none';
    });
}
