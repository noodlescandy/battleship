const WebSocket = require('ws');
// make sure the ports are aligned between client and server (external file maybe?)
const portNo = 9576;
const wss = new WebSocket.Server({ port: portNo });

connections = new Map();
games = {}; // dict with game codes as key and list of players as value

// checks board given and returns true if OK and false if not a valid board
function validateBoard(board){
    if (!(Array.isArray(board))){
        return "not an array";
    }
    if (board.length != 10){
        return "bad length";
    }
    // validate number of ship tiles on board (5,4,3,3,2=17)
    countShipTiles = 0;
    foundCarrier = false;
    for(var i = 0; i < board.length; i++){
        if (board[i].length != 10){
            return "bad row length " + board[i].length;
        }
        maxContinuousShipTiles = 0;
        continuousShipTiles = 0;
        for(var j = 0; j < board[i].length; j++){
            if(board[i][j]){
                countShipTiles++;
                continuousShipTiles++;
                adjacents = 0;
                if (i != 0){
                    if (board[i-1][j] === 1) adjacents++;
                }
                if (j != 0){
                    if (board[i][j-1] === 1) adjacents++;
                }
                if (i < 9){
                    if (board[i+1][j] === 1) adjacents++;
                }
                if (j < 9){
                    if (board[i][j+1] === 1) adjacents++;
                }
                if (adjacents > 2){
                    return "ships cannot be adjacent";
                }
                if (adjacents === 0){
                    return "invalid ship detected. Ships cannot be size 1";
                }
            }
            else{
                if(maxContinuousShipTiles < continuousShipTiles) maxContinuousShipTiles = continuousShipTiles;
                continuousShipTiles = 0;
            }
        }
        if(maxContinuousShipTiles < continuousShipTiles) maxContinuousShipTiles = continuousShipTiles;
        if (maxContinuousShipTiles > 5 || (foundCarrier && maxContinuousShipTiles === 5)){
            return "ships cannot be adjacent horizontally.";
        }
        if (maxContinuousShipTiles === 5){
            foundCarrier = true;
        }
    }
    if(countShipTiles != 17){
        return "bad ship count " + countShipTiles;
    }
    // Check corners for adjacency
    if ((board[0][0] === 1 && board[0][1] === 1 && board[1][0] === 1) || (board[9][9] === 1 & board[8][9] === 1 && board[9][8] === 1)){
        return "ships cannot be adjacent";
    }
    // check up/down for continuous tiles
    // has to happen seperately so it doesn't miss any while counting horizontals.
    for(var i = 0; i < board.length; i++){
        maxContinuousShipTiles = 0;
        continuousShipTiles = 0;
        for(var j = 0; j < board.length; j++){
            if (board[j][i] === 1){
                continuousShipTiles++;
            }
            else{
                if(maxContinuousShipTiles < continuousShipTiles) maxContinuousShipTiles = continuousShipTiles;
                continuousShipTiles = 0;
            }
        }
        if(maxContinuousShipTiles < continuousShipTiles) maxContinuousShipTiles = continuousShipTiles;
        if (maxContinuousShipTiles > 5 || (foundCarrier && maxContinuousShipTiles === 5)){
            return "ships cannot be adjacent vertically.";
        }
        if (maxContinuousShipTiles === 5){
            foundCarrier = true;
        }
    }
    return "ok";
}

// ships will not have any adjacent ships, so are either straight vert or horizontal. Ship is sunk if it has no 1s left on it
function checkIfSunk(board, y, x){
    // try going left, then right
    y = Number.parseInt(y);
    x = Number.parseInt(x);
    for(var i = 1; i > -2; i -= 2) {
        currentY = y;
        currentX = x;
        vertTile = board[currentY][x];
        horiTile = board[y][currentX];
        while (vertTile == 3 || horiTile == 3){
            if (vertTile == 3){
                currentY += i;
                vertTile = currentY > 9 || currentY < 0 ? 0 : board[currentY][x];
            }
            if (horiTile == 3){
                currentX += i;
                horiTile = currentX > 9 || currentX < 0 ?0 : board[y][currentX];
            }
        }
        if (vertTile == 1){
            return false;
        }
        if (horiTile == 1){
            return false;
        }
    }
    return true; // no unhit tiles, only ocean or hit ocean surrounding hit tiles
}

// checks the board for any 1s, which indicate an unhit ship tile
function shipsLeft(board){
    for (var i = 0; i < board.length; i++){
        if (board[i].includes(1)) return true;
    }
    return false;
}

// sends the text to the websocket if it is open
function sendMsg(ws, text){
    if (ws.readyState === WebSocket.OPEN){
        ws.send(JSON.stringify(text));
    }
}

wss.on('connection', (ws) => {
    // inital connection, set connection vars
    connections.set(ws, ["init", -1, undefined]);
    console.log('Client connected. Total:', connections.size);
    
    // handle messages and states
    ws.on('message', (message) => {
        messageData = JSON.parse(message);
        console.log(messageData); // debug to test message content
        switch(connections.get(ws)[0]) {
            case "init": // server setup state (not in lobby)
                // based on message, should be about either starting a game or joining a game
                if (messageData === "start"){
                    if (connections.get(ws)[1] != -1){ // already in lobby, resend game code
                        sendMsg(ws, lobby.toString());
                        break;
                    }
                    lobby = -1;
                    do {
                        lobby = Math.floor(Math.random() * 10000);
                    } while (lobby in games);
                    connections.set(ws, [connections.get(ws)[0], lobby, undefined]);
                    games[lobby] = [ws];
                    console.log("New Game", lobby, "created.");
                    sendMsg(ws, lobby.toString());
                }
                else{
                    content = messageData.split(" ");
                    if (content[0] === "join"){
                        code = parseInt(content[1], 10);
                        if (!(code in games)){
                            sendMsg(ws, "Error: code not found, use start to create game");
                            break;
                        }
                        if (games[code].length >= 2){
                            sendMsg(ws, "Error: game full");
                            break;
                        }
                        connections.set(ws, [connections.get(ws)[0], code, undefined]);
                        games[code][1] = ws;
                        games[code].forEach(function each(client) {
                            connections.set(client, ["placing", connections.get(ws)[1], undefined]);
                            sendMsg(client, "ready for game setup");
                        });
                    }
                    else{
                        // unrecognized command
                        sendMsg(ws, "Error: invalid command for current init state. Valid commands are start and join <code>");
                    }
                }
                break;
            case 'placing':
                // structure of board expected -- 2D Array 10x10 with 0s and 1s for ships.
                flag = validateBoard(messageData);
                if (flag != "ok"){
                    sendMsg(ws, flag);
                    break;
                }
                sendMsg(ws, "valid board");
                // check if other client has submitted theirs yet. If they have, start game and decide turns. 
                connections.set(ws, ["wait", connections.get(ws)[1], messageData]);
                games[code].forEach(function each(client){
                    if (ws != client && connections.get(client)[0] === "wait"){
                        turn = Math.round(Math.random()); // 0 or 1
                        sendMsg(client, "game start");
                        sendMsg(ws, "game start");
                        if (turn){
                            connections.set(client, ['turn', connections.get(client)[1], connections.get(client)[2]]);
                            sendMsg(client, "your turn");
                            sendMsg(ws, "waiting for other player");
                        }
                        else{
                            connections.set(ws, ['turn', connections.get(ws)[1], connections.get(ws)[2]]);
                            sendMsg(ws, "your turn");
                            sendMsg(client, "waiting for other player");
                        }
                    }
                });
                break;
                case 'turn':
                    // on turn, receive message from client with coords they want to hit
                    y = -1;
                    x = -1;
                    try {
                        coords = messageData.split(" ");
                        if (coords.length != 2) throw "invalid coords";
                        y = parseInt(coords[0], 10);
                        if (Number.isNaN(y) || y < 0 || y > 9) throw "invalid y";
                        x = parseInt(coords[1], 10);
                        if (Number.isNaN(x) || x < 0 || x > 9) throw "invalid x";
                    } catch (error) {
                        sendMsg(ws, "Error: " + error + ". Format: 0-9 0-9 for y, x on board.");
                        break;
                    }
    
                    let opposingPlayer = undefined;
                    games[connections.get(ws)[1]].forEach(function each(client) {
                        if (ws != client) {
                            opposingPlayer = client;
                        }
                    });
    
                    let board = connections.get(opposingPlayer)[2];
                    if (board[y][x] > 1) {
                        sendMsg(ws, "Error: already shot here!");
                        break;
                    }
    
                    board[y][x] += 2;
                    if (board[y][x] === 3) {
                        sendMsg(ws, `hit ${y} ${x}`);
                        sendMsg(ws, "hit (go again)");
    
                        // Notify the opponent about the hit on their grid
                        sendMsg(opposingPlayer, JSON.stringify({
                            type: "updateOwnGrid",
                            data: { row: y, col: x, status: "hit" }
                        }));
    
                        // Check if the ship was sunk
                        const wasSunk = checkIfSunk(board, y, x);
                        if (wasSunk) {
                            sendMsg(ws, "Sunk a ship!");
                            sendMsg(opposingPlayer, "Opponent sunk one of your ships!");
    
                            // If no ships left, game is over
                            if (!shipsLeft(board)) {
                                sendMsg(ws, "You Win!");
                                sendMsg(opposingPlayer, "You Lose!");
                                connections.set(ws, ["init", -1, undefined]);
                                connections.set(opposingPlayer, ["init", -1, undefined]);
                            }
                        }
                        break;
                    }
    
                    sendMsg(ws, `miss ${y} ${x}`);
                    sendMsg(ws, "miss");
    
                    // Notify the opponent about the miss on their grid
                    sendMsg(opposingPlayer, JSON.stringify({
                        type: "updateOwnGrid",
                        data: { row: y, col: x, status: "miss" }
                    }));
    
                    sendMsg(ws, "waiting for other player");
                    connections.set(ws, ['wait', connections.get(ws)[1], connections.get(ws)[2]]);
                    sendMsg(opposingPlayer, "your turn");
                    connections.set(opposingPlayer, ['turn', connections.get(opposingPlayer)[1], connections.get(opposingPlayer)[2]]);
                    break;
    
                case 'wait':
                    sendMsg(ws, "Please wait for other client.");
                    break;
    
                default:
                    sendMsg(ws, "Error: Message not recognized/implemented. Try again later.");
                    break;
            }
        });

    ws.on('close', () => {
        if(connections.get(ws)[1] != -1){
            lobby = connections.get(ws)[1];
            console.log("closing lobby", lobby);
            games[lobby].forEach(function each(client) {
                if (client != ws) {
                    connections.set(client, ["init", -1, undefined]);
                    sendMsg(client, "disconnected return to menu");
                    delete games[lobby];
                }
            });
        }
        connections.delete(ws);
        console.log('Connection closed. Total:', connections.size);
    });
});

console.log('WebSocket server running on port', portNo);

