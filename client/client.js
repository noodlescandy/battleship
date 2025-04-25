const ws = new WebSocket('ws://localhost:9576');

const startGameButton = document.getElementById('startGame');
const joinGameButton = document.getElementById('joinGame');
const joinCodeInput = document.getElementById('joinCode');
const messagesDiv = document.getElementById('messages');
const grid = document.getElementById('grid');
const submitBoardButton = document.getElementById('submitBoard');
const shipSelect = document.getElementById('shipSelect');
const rowInput = document.getElementById('rowInput');
const colInput = document.getElementById('colInput');
const orientationSelect = document.getElementById('orientationSelect');
const placeShipButton = document.getElementById('placeShipButton');

// Handle WebSocket connection open
ws.onopen = () => {
    console.log('Connected to server');
};

// Handle WebSocket messages
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message === "game start") {
        messagesDiv.textContent = "Game has started!";
        grid.style.pointerEvents = "none"; // Disable further ship placement
    } else if (message === "your turn") {
        messagesDiv.textContent = "It's your turn! Make a move.";
    } else if (message === "waiting for other player") {
        messagesDiv.textContent = "Waiting for the other player's move...";
    } else {
        messagesDiv.textContent = message; // Display other messages
    }

    console.log('Message from server:', message);
};

// Handle WebSocket errors
ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

// Handle WebSocket close
ws.onclose = () => {
    console.log('Disconnected from server');
};

// Start Game button click
startGameButton.addEventListener('click', () => {
    ws.send(JSON.stringify('start'));
});

// Join Game button click
joinGameButton.addEventListener('click', () => {
    const code = joinCodeInput.value.trim();
    if (code) {
        ws.send(JSON.stringify(`join ${code}`));
    } else {
        messagesDiv.textContent = 'Please enter a valid game code.';
    }
});

// Place Ship button click
placeShipButton.addEventListener('click', () => {
    const size = parseInt(shipSelect.value, 10);
    const row = parseInt(rowInput.value, 10);
    const col = parseInt(colInput.value, 10);
    const orientation = orientationSelect.value;

    // Validate inputs
    if (isNaN(row) || isNaN(col) || row < 0 || row > 9 || col < 0 || col > 9) {
        messagesDiv.textContent = 'Invalid row or column. Please enter values between 0 and 9.';
        return;
    }

    // Check if the ship fits on the grid
    if (orientation === 'horizontal' && col + size > 10) {
        messagesDiv.textContent = 'Ship does not fit horizontally!';
        return;
    }
    if (orientation === 'vertical' && row + size > 10) {
        messagesDiv.textContent = 'Ship does not fit vertically!';
        return;
    }

    // Check for overlap
    for (let k = 0; k < size; k++) {
        const targetCell = orientation === 'horizontal'
            ? grid.querySelector(`[data-row="${row}"][data-col="${col + k}"]`)
            : grid.querySelector(`[data-row="${row + k}"][data-col="${col}"]`);
        if (targetCell.classList.contains('ship')) {
            messagesDiv.textContent = 'Cannot overlap ships!';
            return;
        }
    }

    // Place the ship on the grid
    for (let k = 0; k < size; k++) {
        const targetCell = orientation === 'horizontal'
            ? grid.querySelector(`[data-row="${row}"][data-col="${col + k}"]`)
            : grid.querySelector(`[data-row="${row + k}"][data-col="${col}"]`);
        targetCell.classList.add('ship');
    }

    // Remove the placed ship from the dropdown
    shipSelect.remove(shipSelect.selectedIndex);
    if (shipSelect.options.length === 0) {
        placeShipButton.disabled = true; // Disable the button if all ships are placed
    }

    messagesDiv.textContent = 'Ship placed successfully!';
});

// Generate the grid
for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
        const cell = document.createElement('div');
        cell.dataset.row = i;
        cell.dataset.col = j;
        grid.appendChild(cell);
    }
}

// Generate the board array from the grid
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

// Handle board submission
submitBoardButton.addEventListener('click', () => {
    const board = generateBoard();
    ws.send(JSON.stringify(board)); // Send the board to the server
    messagesDiv.textContent = 'Board submitted. Waiting for the other player...';
});