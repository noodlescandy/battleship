const ws = new WebSocket('ws://localhost:9576');

const startGameButton = document.getElementById('startGame');
const joinGameButton = document.getElementById('joinGame');
const joinCodeInput = document.getElementById('joinCode');
const messagesDiv = document.getElementById('messages');

// Handle WebSocket connection open
ws.onopen = () => {
    console.log('Connected to server');
};

// Handle WebSocket messages
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    messagesDiv.textContent = message;
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