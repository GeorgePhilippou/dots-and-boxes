const SVG_NS = "http://www.w3.org/2000/svg";
const STORAGE_KEY = "dots-boxes-game-v2";

const elements = {
  welcome: document.querySelector("#welcome"),
  game: document.querySelector("#game"),
  result: document.querySelector("#result"),
  form: document.querySelector("#setup-form"),
  playerOne: document.querySelector("#player-one"),
  playerOneLabel: document.querySelector("#player-one-label"),
  playerTwo: document.querySelector("#player-two"),
  playerTwoLabel: document.querySelector("#player-two-label"),
  modeButtons: [...document.querySelectorAll(".mode-button")],
  onlineOptions: document.querySelector("#online-options"),
  onlineButtons: [...document.querySelectorAll(".online-button")],
  roomCodeField: document.querySelector("#room-code-field"),
  roomCode: document.querySelector("#room-code"),
  startButton: document.querySelector("#start-button"),
  boardSize: document.querySelector("#board-size"),
  board: document.querySelector("#board"),
  turnName: document.querySelector("#turn-name"),
  turnLabel: document.querySelector("#turn-label"),
  scoreOneName: document.querySelector("#score-one-name"),
  scoreTwoName: document.querySelector("#score-two-name"),
  scoreOne: document.querySelector("#score-one"),
  scoreTwo: document.querySelector("#score-two"),
  scoreOneCard: document.querySelector("#score-one-card"),
  scoreTwoCard: document.querySelector("#score-two-card"),
  gameHint: document.querySelector("#game-hint"),
  winnerTitle: document.querySelector("#winner-title"),
  winnerScore: document.querySelector("#winner-score")
};

let state = null;
let gesture = null;
let selectedMode = "local";
let selectedOnlineAction = "create";
let computerTimer = null;
let firebasePromise = null;
let onlineSession = null;

const FIREBASE_CONFIG = {
  projectId: "dots-and-boxes-george",
  appId: "1:320591270035:web:cb1a5eb0b1351abbf47d66",
  databaseURL: "https://dots-and-boxes-george-default-rtdb.europe-west1.firebasedatabase.app",
  apiKey: "AIzaSyDVuGlszODYxT20qlHAOmksGnp1Sj4tneA",
  authDomain: "dots-and-boxes-george.firebaseapp.com",
  messagingSenderId: "320591270035"
};

function newGame(players, size, mode = "local") {
  return { players, size, mode, turn: 0, edges: {}, boxes: {}, scores: [0, 0], complete: false };
}

function normalizeGame(game) {
  game.edges ||= {};
  game.boxes ||= {};
  return game;
}

async function loadFirebase() {
  if (!firebasePromise) {
    firebasePromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js")
    ]).then(([appApi, authApi, databaseApi]) => {
      const app = appApi.initializeApp(FIREBASE_CONFIG);
      return { app, authApi, databaseApi, auth: authApi.getAuth(app), db: databaseApi.getDatabase(app) };
    });
  }
  const firebase = await firebasePromise;
  if (!firebase.auth.currentUser) await firebase.authApi.signInAnonymously(firebase.auth);
  return firebase;
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint8Array(6));
  return [...values].map((value) => alphabet[value % alphabet.length]).join("");
}

function normalizeRoomCode(value) {
  return value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
}

function edgeId(a, b) {
  const first = a.r < b.r || (a.r === b.r && a.c < b.c) ? a : b;
  const second = first === a ? b : a;
  return `${first.r},${first.c}-${second.r},${second.c}`;
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function pointFor(r, c) {
  const pad = 65;
  const step = (600 - pad * 2) / (state.size - 1);
  return { x: pad + c * step, y: pad + r * step };
}

function renderBoard() {
  elements.board.replaceChildren();
  const boxLayer = svgEl("g");
  const edgeLayer = svgEl("g");
  const dotLayer = svgEl("g");

  for (let r = 0; r < state.size - 1; r += 1) {
    for (let c = 0; c < state.size - 1; c += 1) {
      const owner = state.boxes[`${r},${c}`];
      if (owner !== undefined) {
        const p1 = pointFor(r, c);
        const p2 = pointFor(r + 1, c + 1);
        boxLayer.append(svgEl("rect", {
          x: p1.x + 9, y: p1.y + 9, width: p2.x - p1.x - 18, height: p2.y - p1.y - 18,
          rx: 16, class: `box player-${owner}`
        }));
      }
    }
  }

  const addEdge = (a, b) => {
    const id = edgeId(a, b);
    const p1 = pointFor(a.r, a.c);
    const p2 = pointFor(b.r, b.c);
    const owner = state.edges[id];
    const group = svgEl("g", { class: `edge-group ${owner === undefined ? "available" : `claimed-${owner}`}`, "data-edge": id });
    group.append(svgEl("line", { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: "edge-visible" }));
    const hit = svgEl("line", { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: "edge-hit" });
    if (owner === undefined) {
      hit.addEventListener("pointerdown", (event) => beginGesture(event, id));
      hit.addEventListener("pointerup", (event) => endGesture(event, id));
    }
    group.append(hit);
    edgeLayer.append(group);
  };

  for (let r = 0; r < state.size; r += 1) {
    for (let c = 0; c < state.size; c += 1) {
      if (c < state.size - 1) addEdge({ r, c }, { r, c: c + 1 });
      if (r < state.size - 1) addEdge({ r, c }, { r: r + 1, c });
      const p = pointFor(r, c);
      dotLayer.append(svgEl("circle", { cx: p.x, cy: p.y, r: 10, class: "dot" }));
    }
  }

  elements.board.append(boxLayer, edgeLayer, dotLayer);
}

function beginGesture(event, id) {
  if (state.complete || !canCurrentDevicePlay()) return;
  event.preventDefault();
  const p = boardCoords(event);
  gesture = { pointerId: event.pointerId, edgeId: id, start: p };
  elements.board.setPointerCapture?.(event.pointerId);
  document.querySelector(`[data-edge="${id}"]`)?.classList.add("preview");
  const line = svgEl("line", { x1: p.x, y1: p.y, x2: p.x, y2: p.y, class: "gesture-line", id: "gesture-line" });
  elements.board.append(line);
}

elements.board.addEventListener("pointermove", (event) => {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const p = boardCoords(event);
  const line = document.querySelector("#gesture-line");
  line?.setAttribute("x2", p.x);
  line?.setAttribute("y2", p.y);
});

elements.board.addEventListener("pointerup", (event) => {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  endGesture(event, gesture.edgeId);
});

elements.board.addEventListener("pointercancel", cancelGesture);

function endGesture(event, id) {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  event.preventDefault();
  const chosenId = gesture.edgeId || id;
  cancelGesture();
  claimEdge(chosenId);
}

function cancelGesture() {
  document.querySelector("#gesture-line")?.remove();
  document.querySelectorAll(".preview").forEach((el) => el.classList.remove("preview"));
  gesture = null;
}

function boardCoords(event) {
  const point = elements.board.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(elements.board.getScreenCTM().inverse());
}

function claimEdge(id, source = "human") {
  if (state.edges[id] !== undefined || state.complete) return;
  if (source === "human" && !canCurrentDevicePlay()) return;
  if (state.mode === "online") {
    claimOnlineEdge(id);
    return;
  }
  const player = state.turn;
  state.edges[id] = player;
  const completed = findCompletedBoxes(id);
  completed.forEach((boxId) => {
    state.boxes[boxId] = player;
    state.scores[player] += 1;
  });

  if (completed.length === 0) state.turn = state.turn === 0 ? 1 : 0;
  state.complete = Object.keys(state.boxes).length === (state.size - 1) ** 2;
  save();
  render();

  if (completed.length) {
    elements.gameHint.textContent = `${state.players[player]} closed ${completed.length > 1 ? `${completed.length} boxes` : "a box"} — play again!`;
  } else {
    elements.gameHint.textContent = "Draw or tap between any two neighbouring dots";
  }
  if (state.complete) window.setTimeout(showResult, 400);
  else scheduleComputerMove();
}

function canCurrentDevicePlay() {
  if (!state || state.complete) return false;
  if (state.mode === "online") {
    return onlineSession?.status === "playing" && state.turn === onlineSession.playerIndex;
  }
  return state.mode !== "computer" || state.turn === 0;
}

function allEdgeIds() {
  const ids = [];
  for (let r = 0; r < state.size; r += 1) {
    for (let c = 0; c < state.size; c += 1) {
      if (c < state.size - 1) ids.push(edgeId({ r, c }, { r, c: c + 1 }));
      if (r < state.size - 1) ids.push(edgeId({ r, c }, { r: r + 1, c }));
    }
  }
  return ids;
}

function boxEdges(r, c) {
  return [
    edgeId({ r, c }, { r, c: c + 1 }),
    edgeId({ r: r + 1, c }, { r: r + 1, c: c + 1 }),
    edgeId({ r, c }, { r: r + 1, c }),
    edgeId({ r, c: c + 1 }, { r: r + 1, c: c + 1 })
  ];
}

function adjacentBoxesForEdge(id) {
  const [start, end] = id.split("-").map((value) => {
    const [r, c] = value.split(",").map(Number);
    return { r, c };
  });
  const boxes = [];
  if (start.r === end.r) {
    if (start.r > 0) boxes.push({ r: start.r - 1, c: start.c });
    if (start.r < state.size - 1) boxes.push({ r: start.r, c: start.c });
  } else {
    if (start.c > 0) boxes.push({ r: start.r, c: start.c - 1 });
    if (start.c < state.size - 1) boxes.push({ r: start.r, c: start.c });
  }
  return boxes;
}

function chooseComputerEdge() {
  const available = allEdgeIds().filter((id) => state.edges[id] === undefined);
  const finishing = available.filter((id) => adjacentBoxesForEdge(id).some(({ r, c }) =>
    boxEdges(r, c).filter((edge) => state.edges[edge] !== undefined).length === 3
  ));
  if (finishing.length) return randomItem(finishing);

  const safe = available.filter((id) => adjacentBoxesForEdge(id).every(({ r, c }) =>
    boxEdges(r, c).filter((edge) => state.edges[edge] !== undefined).length < 2
  ));
  return randomItem(safe.length ? safe : available);
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function scheduleComputerMove() {
  window.clearTimeout(computerTimer);
  if (!state || state.mode !== "computer" || state.turn !== 1 || state.complete) return;
  elements.gameHint.textContent = `${state.players[1]} is choosing a line…`;
  computerTimer = window.setTimeout(() => {
    const id = chooseComputerEdge();
    if (id) claimEdge(id, "computer");
  }, 560);
}

function findCompletedBoxes(id) {
  return completedBoxesFor(state, id);
}

function completedBoxesFor(game, id) {
  const [start, end] = id.split("-").map((value) => {
    const [r, c] = value.split(",").map(Number);
    return { r, c };
  });
  const candidates = [];
  if (start.r === end.r) {
    if (start.r > 0) candidates.push({ r: start.r - 1, c: start.c });
    if (start.r < game.size - 1) candidates.push({ r: start.r, c: start.c });
  } else {
    if (start.c > 0) candidates.push({ r: start.r, c: start.c - 1 });
    if (start.c < game.size - 1) candidates.push({ r: start.r, c: start.c });
  }
  return candidates.filter(({ r, c }) => {
    return game.boxes[`${r},${c}`] === undefined && boxEdges(r, c).every((edge) => game.edges[edge] !== undefined);
  }).map(({ r, c }) => `${r},${c}`);
}

async function createOnlineRoom(playerName, size) {
  const firebase = await loadFirebase();
  let code;
  let roomRef;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    code = makeRoomCode();
    roomRef = firebase.databaseApi.ref(firebase.db, `rooms/${code}`);
    if (!(await firebase.databaseApi.get(roomRef)).exists()) break;
  }
  const game = newGame([playerName, "Waiting…"], size, "online");
  await firebase.databaseApi.set(roomRef, {
    hostUid: firebase.auth.currentUser.uid,
    status: "waiting",
    createdAt: firebase.databaseApi.serverTimestamp(),
    state: game
  });
  beginOnlineSession(firebase, roomRef, code, 0, "waiting", game);
}

async function joinOnlineRoom(playerName, rawCode) {
  const code = normalizeRoomCode(rawCode);
  if (code.length !== 6) throw new Error("Enter the six-character room code.");
  const firebase = await loadFirebase();
  const roomRef = firebase.databaseApi.ref(firebase.db, `rooms/${code}`);
  const snapshot = await firebase.databaseApi.get(roomRef);
  if (!snapshot.exists()) throw new Error("That room could not be found. Check the code and try again.");
  const room = snapshot.val();
  if (room.status !== "waiting" || room.guestUid) throw new Error("That room already has two players.");
  await firebase.databaseApi.set(
    firebase.databaseApi.child(roomRef, "guestUid"),
    firebase.auth.currentUser.uid
  );
  await firebase.databaseApi.update(roomRef, {
    status: "playing",
    "state/players/1": playerName
  });
  const joinedState = normalizeGame({ ...room.state, players: [room.state.players[0], playerName] });
  beginOnlineSession(firebase, roomRef, code, 1, "playing", joinedState);
}

function beginOnlineSession(firebase, roomRef, code, playerIndex, status, initialState) {
  onlineSession?.unsubscribe?.();
  onlineSession = { firebase, roomRef, code, playerIndex, status, unsubscribe: null };
  state = initialState;
  save();
  showGame();
  history.replaceState(null, "", `${location.pathname}?room=${code}`);
  onlineSession.unsubscribe = firebase.databaseApi.onValue(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      elements.gameHint.textContent = "This room is no longer available.";
      return;
    }
    const room = snapshot.val();
    const wasComplete = state?.complete;
    onlineSession.status = room.status;
    state = normalizeGame(room.state);
    render();
    updateOnlineHint();
    if (state.complete && !wasComplete) window.setTimeout(showResult, 350);
  });
}

function updateOnlineHint() {
  if (!onlineSession) return;
  if (onlineSession.status === "waiting") {
    elements.gameHint.textContent = `Room ${onlineSession.code} · Waiting for player two…`;
  } else if (state.complete) {
    elements.gameHint.textContent = `Room ${onlineSession.code} · Game complete`;
  } else if (state.turn === onlineSession.playerIndex) {
    elements.gameHint.textContent = `Room ${onlineSession.code} · Your turn`;
  } else {
    elements.gameHint.textContent = `Room ${onlineSession.code} · ${state.players[state.turn]}'s turn`;
  }
}

async function claimOnlineEdge(id) {
  if (!onlineSession || !canCurrentDevicePlay()) return;
  const { databaseApi } = onlineSession.firebase;
  const stateRef = databaseApi.child(onlineSession.roomRef, "state");
  try {
    await databaseApi.runTransaction(stateRef, (remoteState) => {
      if (!remoteState) return;
      normalizeGame(remoteState);
      if (remoteState.complete || remoteState.turn !== onlineSession.playerIndex || remoteState.edges[id] !== undefined) return;
      const next = normalizeGame(structuredClone(remoteState));
      const player = next.turn;
      next.edges[id] = player;
      const completed = completedBoxesFor(next, id);
      completed.forEach((boxId) => {
        next.boxes[boxId] = player;
        next.scores[player] += 1;
      });
      if (completed.length === 0) next.turn = player === 0 ? 1 : 0;
      next.complete = Object.keys(next.boxes).length === (next.size - 1) ** 2;
      return next;
    }, { applyLocally: false });
  } catch (error) {
    console.error("Online move failed", error);
    elements.gameHint.textContent = "The move did not sync. Check your connection and try again.";
  }
}

function render() {
  elements.scoreOneName.textContent = state.players[0];
  elements.scoreTwoName.textContent = state.players[1];
  elements.scoreOne.textContent = state.scores[0];
  elements.scoreTwo.textContent = state.scores[1];
  elements.turnName.textContent = state.players[state.turn];
  elements.turnName.style.color = state.turn === 0 ? "var(--coral)" : "var(--blue)";
  elements.scoreOneCard.classList.toggle("active", state.turn === 0);
  elements.scoreTwoCard.classList.toggle("active", state.turn === 1);
  if (state.mode === "online") {
    elements.turnLabel.textContent = onlineSession?.status === "waiting" ? "Room ready" : (state.turn === onlineSession?.playerIndex ? "Your turn" : "Their turn");
  } else {
    elements.turnLabel.textContent = state.mode === "computer" && state.turn === 1 ? "Computer's turn" : "Your turn";
  }
  renderBoard();
}

function showGame() {
  elements.welcome.hidden = true;
  elements.game.hidden = false;
  elements.result.hidden = true;
  render();
  scheduleComputerMove();
}

function showWelcome() {
  window.clearTimeout(computerTimer);
  onlineSession?.unsubscribe?.();
  onlineSession = null;
  if (location.search) history.replaceState(null, "", location.pathname);
  elements.result.hidden = true;
  elements.game.hidden = true;
  elements.welcome.hidden = false;
}

function showResult() {
  const [a, b] = state.scores;
  if (a === b) elements.winnerTitle.textContent = "A perfect draw!";
  else elements.winnerTitle.textContent = `${state.players[a > b ? 0 : 1]} wins!`;
  elements.winnerScore.textContent = `${Math.max(a, b)} boxes to ${Math.min(a, b)}`;
  elements.result.hidden = false;
}

async function restart() {
  if (state.mode === "online" && onlineSession) {
    const resetState = newGame([...state.players], state.size, "online");
    await onlineSession.firebase.databaseApi.set(
      onlineSession.firebase.databaseApi.child(onlineSession.roomRef, "state"),
      resetState
    );
    elements.result.hidden = true;
    return;
  }
  state = newGame([...state.players], state.size, state.mode);
  save();
  elements.gameHint.textContent = "Draw or tap between any two neighbouring dots";
  showGame();
}

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const originalLabel = elements.startButton.innerHTML;
  elements.startButton.disabled = true;
  elements.startButton.textContent = selectedMode === "online" ? "Connecting…" : "Starting…";
  const players = [elements.playerOne.value.trim() || "Player one", elements.playerTwo.value.trim() || "Player two"];
  try {
    if (selectedMode === "online") {
      if (selectedOnlineAction === "create") await createOnlineRoom(players[0], Number(elements.boardSize.value));
      else await joinOnlineRoom(players[0], elements.roomCode.value);
    } else {
      state = newGame(players, Number(elements.boardSize.value), selectedMode);
      save();
      showGame();
    }
  } catch (error) {
    window.alert(error?.code === "auth/operation-not-allowed"
      ? "Online rooms need Anonymous sign-in enabled in Firebase first."
      : (error?.message || "The online room could not be opened."));
  } finally {
    elements.startButton.disabled = false;
    elements.startButton.innerHTML = originalLabel;
  }
});

elements.modeButtons.forEach((button) => button.addEventListener("click", () => {
  selectedMode = button.dataset.mode;
  elements.modeButtons.forEach((item) => item.classList.toggle("active", item === button));
  const computer = selectedMode === "computer";
  const online = selectedMode === "online";
  elements.playerTwo.closest("label").hidden = online;
  document.querySelector(".versus").hidden = online;
  elements.onlineOptions.hidden = !online;
  document.querySelector(".size-field").hidden = online && selectedOnlineAction === "join";
  elements.playerOneLabel.textContent = online ? "Your name" : "Player one";
  elements.playerTwo.disabled = computer;
  elements.playerTwo.value = computer ? "Computer" : (elements.playerTwo.value === "Computer" ? "Megan" : elements.playerTwo.value);
  elements.playerTwoLabel.textContent = computer ? "Opponent" : "Player two";
  elements.startButton.innerHTML = online ? `${selectedOnlineAction === "create" ? "Create room" : "Join room"} <span>→</span>` : "Start playing <span>→</span>";
}));

elements.onlineButtons.forEach((button) => button.addEventListener("click", () => {
  selectedOnlineAction = button.dataset.onlineAction;
  elements.onlineButtons.forEach((item) => item.classList.toggle("active", item === button));
  const joining = selectedOnlineAction === "join";
  elements.roomCodeField.hidden = !joining;
  document.querySelector(".size-field").hidden = joining;
  elements.startButton.innerHTML = `${joining ? "Join room" : "Create room"} <span>→</span>`;
}));

elements.roomCode.addEventListener("input", () => {
  elements.roomCode.value = normalizeRoomCode(elements.roomCode.value);
});

document.querySelector("#home-button").addEventListener("click", showWelcome);
document.querySelector("#result-home-button").addEventListener("click", showWelcome);
document.querySelector("#restart-button").addEventListener("click", restart);
document.querySelector("#rematch-button").addEventListener("click", restart);

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved?.players?.length === 2 && saved?.size) {
    state = saved;
    state.mode ||= "local";
    selectedMode = state.mode;
    elements.modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.mode === selectedMode));
    elements.playerOne.value = state.players[0];
    elements.playerTwo.value = state.players[1];
    elements.playerTwo.disabled = selectedMode === "computer";
    elements.playerTwoLabel.textContent = selectedMode === "computer" ? "Opponent" : "Player two";
    elements.boardSize.value = String(state.size);
    if (!state.complete && state.mode !== "online") showGame();
  }
} catch { localStorage.removeItem(STORAGE_KEY); }

const linkedRoom = normalizeRoomCode(new URLSearchParams(location.search).get("room") || "");
if (linkedRoom.length === 6) {
  document.querySelector('[data-mode="online"]').click();
  document.querySelector('[data-online-action="join"]').click();
  elements.roomCode.value = linkedRoom;
}

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
