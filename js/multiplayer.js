// ============================================================
// MULTIPLAYER CLIENT MODULE
// ============================================================
// Connects to the WebSocket server, manages room state,
// and bridges network events to the game controller.

export class MultiplayerClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.connected = false;
    this.roomCode = null;
    this.seatIdx = -1;
    this.isHost = false;
    this.playerName = '';
    this.players = [];
    this.onRoomUpdate = null;    // callback(room)
    this.onGameState = null;     // callback(state)
    this.onAction = null;        // callback(action)
    this.onGameOver = null;      // callback(result)
    this.onChat = null;          // callback(msg)
    this.onError = null;         // callback(error)
    this.onConnect = null;       // callback()
    this.onDisconnect = null;    // callback()
    this.onPlayerEvent = null;   // callback(event)
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);
      } catch (e) {
        reject(e);
        return;
      }

      this.ws.onopen = () => {
        this.connected = true;
        if (this.onConnect) this.onConnect();
        resolve();
      };

      this.ws.onclose = () => {
        this.connected = false;
        if (this.onDisconnect) this.onDisconnect();
      };

      this.ws.onerror = (e) => {
        reject(e);
      };

      this.ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        this._handleMessage(msg);
      };
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.roomCode = null;
    this.seatIdx = -1;
  }

  _send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'room':
        this.roomCode = msg.room;
        this.seatIdx = msg.you;
        this.isHost = msg.isHost;
        this.players = msg.players;
        if (this.onRoomUpdate) this.onRoomUpdate(msg);
        break;

      case 'gameState':
        if (this.onGameState) this.onGameState(msg);
        break;

      case 'action':
        if (this.onAction) this.onAction(msg);
        break;

      case 'gameOver':
        if (this.onGameOver) this.onGameOver(msg);
        break;

      case 'chat':
        if (this.onChat) this.onChat(msg);
        break;

      case 'error':
        if (this.onError) this.onError(msg.message);
        break;

      case 'playerLeft':
      case 'playerRejoined':
        if (this.onPlayerEvent) this.onPlayerEvent(msg);
        break;
    }
  }

  // ========== ACTIONS ==========

  createRoom(name) {
    this.playerName = name;
    this._send({ type: 'create', name });
  }

  joinRoom(code, name) {
    this.playerName = name;
    this._send({ type: 'join', room: code.toUpperCase(), name });
  }

  startGame() {
    this._send({ type: 'start' });
  }

  discard(tileIndex) {
    this._send({ type: 'discard', tileIndex });
  }

  claim(action, combination = 0) {
    this._send({ type: 'claim', action, combination });
  }

  skip() {
    this._send({ type: 'skip' });
  }

  declareMahjong() {
    this._send({ type: 'mahjong' });
  }

  concealedKong(tileIndex) {
    this._send({ type: 'concealedKong', tileIndex });
  }

  sortHand() {
    this._send({ type: 'sort' });
  }

  chat(text) {
    this._send({ type: 'chat', text });
  }

  restart() {
    this._send({ type: 'restart' });
  }
}

// ============================================================
// DEFAULT SERVER URL
// ============================================================
export function getServerUrl() {
  // If we're loaded from the game server, use same host
  const loc = window.location;
  const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${loc.hostname}:8878`;
}
