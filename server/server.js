const WebSocket = require('ws');
// make sure the ports are aligned between client and server (external file maybe?)
const portNo = 9576;
const wss = new WebSocket.Server({ port: portNo });

connections = [];
const games = {}; // dict with game codes as key and list of players as value

wss.on('connection', (ws) => {
    // inital connection
    connections.push(ws);
    console.log('Client connected. Total:', connections.length);
    state = "init";
    server_code = -1;
    
    // handle messages and states
    ws.on('message', (message) => {
        messageData = JSON.parse(message)
        console.log(messageData); // debug to test message content
        switch(state) {
            case "init": // server setup state (not in lobby)
                // based on message, should be about either starting a game or joining a game
                if (messageData === "start"){
                    // generate code for lobby, making sure it isn't being used already in games
                    // create new entry in games with the code as the key and the value as a list with the ws as the first index
                    // send to client the code of the game, for the client to share
                    ws.send(JSON.stringify("0000"));
                }
                else{
                    content = messageData.split(" ");
                    if (content[0] === "join"){
                        code = content[1];
                        // check for code in games
                        // if code not found, return error
                        ws.send(JSON.stringify("Error: code not found"));
                        // if code found
                            // add client as value to list in dict
                            // move both clients to setup state
                            // send message to both clients to begin setup.
                    }
                    else{
                        // unrecognized command
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify("Error: invalid command for current init state. Valid commands are start and join <code>"));
                        }
                    }
                }
                break;
            default:
                // unknown state/ not implemented
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify("Error: Message not recognized/implemented. Try again later."));
                }
                break;
        }
    });

    ws.on('close', () => {
        // end game, tell other client if connected
        connections = connections.filter(connection => connection !== ws);
        console.log('Connection closed. Total:', connections.length);
        if(server_code != -1){
            // connected to a game lobby, close the lobby for all players.
            console.log("closing game lobby");
            // get other ws listed in list that isn't this ws
            // put them in init state
            // send message that other player is disconnected and they are now in init state.
        }
    });
});

console.log('WebSocket server running on port', portNo);