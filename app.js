const SVG_NS = "http://www.w3.org/2000/svg";
const STORAGE_KEY = "dots-boxes-prototype-v1";

const elements = {
  welcome: document.querySelector("#welcome"),
  game: document.querySelector("#game"),
  result: document.querySelector("#result"),
  form: document.querySelector("#setup-form"),
  playerOne: document.querySelector("#player-one"),
  playerTwo: document.querySelector("#player-two"),
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

function newGame(players, size) {
  return { players, size, turn: 0, edges: {}, boxes: {}, scores: [0, 0], complete: false };
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
  if (state.complete) return;
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

function claimEdge(id) {
  if (state.edges[id] !== undefined || state.complete) return;
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
}

function findCompletedBoxes(id) {
  const [start, end] = id.split("-").map((value) => {
    const [r, c] = value.split(",").map(Number);
    return { r, c };
  });
  const candidates = [];
  if (start.r === end.r) {
    if (start.r > 0) candidates.push({ r: start.r - 1, c: start.c });
    if (start.r < state.size - 1) candidates.push({ r: start.r, c: start.c });
  } else {
    if (start.c > 0) candidates.push({ r: start.r, c: start.c - 1 });
    if (start.c < state.size - 1) candidates.push({ r: start.r, c: start.c });
  }
  return candidates.filter(({ r, c }) => {
    const top = edgeId({ r, c }, { r, c: c + 1 });
    const bottom = edgeId({ r: r + 1, c }, { r: r + 1, c: c + 1 });
    const left = edgeId({ r, c }, { r: r + 1, c });
    const right = edgeId({ r, c: c + 1 }, { r: r + 1, c: c + 1 });
    return state.boxes[`${r},${c}`] === undefined && [top, bottom, left, right].every((edge) => state.edges[edge] !== undefined);
  }).map(({ r, c }) => `${r},${c}`);
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
  renderBoard();
}

function showGame() {
  elements.welcome.hidden = true;
  elements.game.hidden = false;
  elements.result.hidden = true;
  render();
}

function showWelcome() {
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

function restart() {
  state = newGame([...state.players], state.size);
  save();
  elements.gameHint.textContent = "Draw or tap between any two neighbouring dots";
  showGame();
}

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const players = [elements.playerOne.value.trim() || "Player one", elements.playerTwo.value.trim() || "Player two"];
  state = newGame(players, Number(elements.boardSize.value));
  save();
  showGame();
});

document.querySelector("#home-button").addEventListener("click", showWelcome);
document.querySelector("#result-home-button").addEventListener("click", showWelcome);
document.querySelector("#restart-button").addEventListener("click", restart);
document.querySelector("#rematch-button").addEventListener("click", restart);

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved?.players?.length === 2 && saved?.size) {
    state = saved;
    elements.playerOne.value = state.players[0];
    elements.playerTwo.value = state.players[1];
    elements.boardSize.value = String(state.size);
    if (!state.complete) showGame();
  }
} catch { localStorage.removeItem(STORAGE_KEY); }

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
