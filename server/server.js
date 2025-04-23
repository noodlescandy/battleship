const WebSocket = require('ws');
// make sure the ports are aligned between client and server (external file maybe?)
const portNo = 9576;
const wss = new WebSocket.Server({ port: portNo });

connections = new Map();
games = {}; // dict with game codes as key and list of players as value

// checks board given and returns true if OK and false if not a valid board
function validateBoard(board){
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

wss.on('connection', (ws) => {
    // inital connection, set connection vars
    connections.set(ws, ["init", -1]);
    console.log('Client connected. Total:', connections.size);
    //lobby = -1;
    
    // handle messages and states
    ws.on('message', (message) => {
        messageData = JSON.parse(message);
        console.log(messageData); // debug to test message content
        switch(connections.get(ws)[0]) {
            case "init": // server setup state (not in lobby)
                // based on message, should be about either starting a game or joining a game
                if (messageData === "start"){
                    if (connections.get(ws)[1] != -1){ // already in lobby, resend game code
                        ws.send(JSON.stringify(lobby.toString()));
                        break;
                    }
                    lobby = -1;
                    do {
                        lobby = Math.floor(Math.random() * 10000);
                    } while (lobby in games);
                    connections.set(ws, [connections.get(ws)[0], lobby]);
                    games[lobby] = [ws];
                    console.log("New Game", lobby, "created.");
                    ws.send(JSON.stringify(lobby.toString()));
                }
                else{
                    content = messageData.split(" ");
                    if (content[0] === "join"){
                        code = parseInt(content[1], 10);
                        if (!(code in games)){
                            ws.send(JSON.stringify("Error: code not found, use start to create game"));
                            break;
                        }
                        if (games[code].length >= 2){
                            ws.send(JSON.stringify("Error: game full"));
                            break;
                        }
                        connections.set(ws, [connections.get(ws)[0], code]);
                        games[code][1] = ws;
                        games[code].forEach(function each(client) {
                            if (client.readyState === WebSocket.OPEN) {
                                connections.set(client, ["placing", connections.get(ws)[1]]);
                                client.send(JSON.stringify("ready for game setup"));
                            }
                        });
                    }
                    else{
                        // unrecognized command
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify("Error: invalid command for current init state. Valid commands are start and join <code>"));
                        }
                    }
                }
                break;
            // one or both clients are in placing mode. They send the boards to the server when it is completed. The server tells both clients on game start
            case 'placing':
                // structure of board expected -- 2D Array 10x10 with 0s and 1s for ships.
                // receive board (messageData)
                // assumes messageData is array
                //board = messageData;
                flag = validateBoard(messageData);
                if (flag != "ok"){
                    ws.send(JSON.stringify(flag));
                    break;
                }
                ws.send(JSON.stringify("valid board"));
                // check if other client has done theirs yet. If they have, return ok for next state and move both to next state. 
                
                break;
            // TODO - other states -- gameTurn, wait (turns)
            case 'wait':
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify("Please wait for other client."));
                }
            default:
                // unknown state/ not implemented
                // wait state goes here.
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify("Error: Message not recognized/implemented. Try again later."));
                }
                break;
        }
    });

    ws.on('close', () => {
        if(connections.get(ws)[1] != -1){
            lobby = connections.get(ws)[1];
            console.log("closing lobby", lobby);
            games[lobby].forEach(function each(client) {
                if (client != ws && client.readyState === WebSocket.OPEN) {
                    connections.set(client, ["init", -1]);
                    client.send(JSON.stringify("disconnected return to menu"));
                    delete games[lobby];
                }
            });
        }
        connections.delete(ws);
        console.log('Connection closed. Total:', connections.size);
    });
});

console.log('WebSocket server running on port', portNo);