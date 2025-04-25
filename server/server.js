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
    for(var i = 0; i < board.length; i++){
        if (board[i].length != 10){
            return "bad row length " + board[i].length;
        }
        for(var j = 0; j < board[i].length; j++){
            if(board[i][j]){
                countShipTiles++;
            }
        }
    }
    if(countShipTiles != 17){
        return "bad ship count " + countShipTiles;
    }
    return "ok";
}

// sends the text to the websocket if it is open
function sendMsg(ws, text){
    if (ws.readyState = WebSocket.OPEN){
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
                // validate coords (is two numbers 0-9) and seperate into two
                y = -1;
                x = -1;
                try {
                    coords = messageData.split(" ");
                    if(coords.length != 2) throw "invalid coords";
                    y = parseInt(coords[0], 10);
                    if(Number.isNaN(y) || y < 0 || y > 9) throw "invalid y";
                    x = parseInt(coords[1], 10);
                    if(Number.isNaN(x) || x < 0 || x > 9) throw "invalid x";
                } catch (error) {
                    sendMsg(ws, "Error: " + error + ".  Format: 0-9 0-9 for y, x on board.");
                    break;
                }
                // if already hit
                // changing board here changes it there bc it's a reference to the object.
                board = connections.get(ws)[2];
                if(board[y][x] > 1){
                    sendMsg(ws, "Error: already shot here!");
                    break;
                }
                board[y][x] += 2;
                if (board[y][x] === 3){
                    sendMsg(ws, "hit (go again)");
                    // check if ship was sunk.
                    // if ship sunk, broadcast that it was
                    break;
                }
                sendMsg(ws, "miss");
                // set turn to other player
                // send them their board since it's changed
                // set ws to wait state
                break;
            case 'wait':
                sendMsg(ws, "Please wait for other client.");
                break;
            default:
                // unknown state/ not implemented
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
                    connections.set(client, ["init", -1]);
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