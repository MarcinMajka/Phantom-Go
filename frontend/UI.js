import {
  createLineSVG,
  createCircleSVG,
  getStarPoints,
  getMatchString,
} from "./utils.js";

export const elements = {
  matchID: document.getElementById("match-id"),
  turn: document.getElementById("player-turn"),
  captures: {
    black: document.getElementById("black-captures"),
    white: document.getElementById("white-captures"),
  },
  addStone: {
    black: document.getElementById("black-stone-button"),
    white: document.getElementById("white-stone-button"),
  },
  removeStone: document.getElementById("remove-stone-button"),
  countScore: document.getElementById("count-score-button"),
  undo: document.getElementById("undo-button"),
  pass: document.getElementById("pass-button"),
  resign: document.getElementById("resign-button"),
  infoContainer: document.getElementById("info-container"),
  stonesInAtari: document.getElementById("stones-in-atari"),
};

if (elements.countScore) {
  elements.countScore.style.visibility = "hidden";
}

export function displayMatchIdElement() {
  if (elements.matchID) {
    elements.matchID.textContent = `Match ID: ${getMatchString()}`;
  }
}

export function updateTurn(currentPlayer) {
  if (currentPlayer === "counting") {
    elements.turn.innerText = "Counting points";
    elements.countScore.style.visibility = "visible";
  } else {
    elements.turn.innerText = "Turn: " + currentPlayer;
  }
}

export function updateCaptures(blackCaptures, whiteCaptures) {
  elements.captures.black.innerText = "Black Captures: " + blackCaptures;
  elements.captures.white.innerText = "White Captures: " + whiteCaptures;
}

export function addHoverEffect(cell, fillColor) {
  cell.addEventListener("mouseover", () => {
    cell.setAttribute("fill", fillColor);
  });
  cell.addEventListener("mouseout", () => {
    cell.setAttribute("fill", "transparent");
  });
}

export function createButton(id, text, onClick) {
  const button = createDiv(id, "button");
  button.innerText = text;
  button.onclick = onClick;
  return button;
}

export function createDiv(id, className) {
  const div = document.createElement("div");
  div.id = id;
  div.className = className;
  return div;
}

let buttonsWereHandledAfterGame = false;

export function handleGameButtonsAfterGame(matchString, isGameOver) {
  if (buttonsWereHandledAfterGame) return;

  buttonsWereHandledAfterGame = true;

  if (elements.addStone.black) {
    elements.addStone.black.style.display = "none";
  }
  if (elements.addStone.white) {
    elements.addStone.white.style.display = "none";
  }

  elements.removeStone.style.display = "none";
  elements.pass.style.display = "none";
  elements.undo.style.display = "none";
  if (elements.resign) {
    elements.resign.style.display = "none";
  }

  if (!isGameOver) {
    elements.countScore.style.visibility = "visible";
  }

  if (!window.location.pathname.includes("main.html")) {
    const mainBoardButton = createLinkToMainBoard(matchString);
    elements.infoContainer.appendChild(mainBoardButton);
  }
}

function createLinkToMainBoard(matchString) {
  return createButton("main-board-button", "Main Board", () => {
    window.location.href = "/frontend/main.html?match=" + matchString;
  });
}

export function highlightStonesInAtari(stones) {
  if (!stones || window.location.pathname.includes("main.html")) return;
  const flatStones = stones.flat(Infinity);
  flatStones.forEach((loc) => {
    // The issue was with sentinels in the backend
    const row = loc.row - 1;
    const col = loc.col - 1;
    const selector = `.stone[data-row="${row}"][data-col="${col}"]`;
    const stone = document.querySelector(selector);
    if (stone) {
      stone.setAttribute("stroke", "red");
      stone.setAttribute("stroke-width", "5");
    }
  });
}

export function showStonesInAtari(stones) {
  if (window.location.pathname.includes("main.html")) return;
  if (stones.black === 0 && stones.white === 0) {
    elements.stonesInAtari.style.visibility = "hidden";
    return;
  } else {
    elements.stonesInAtari.style.visibility = "visible";
  }

  elements.stonesInAtari.innerText = `Black stones in atari: ${stones.black}\nWhite stones in atari: ${stones.white}`;
}

export function showElement(element) {
  if (element) {
    element.style.visibility = "visible";
  }
}

export function drawGridLines(board, rows, cols, lineWidth = "1") {
  // Draw vertical lines
  for (let i = 0; i < cols; i++) {
    const line = createLineSVG(true, i, "black", lineWidth);
    board.appendChild(line);
  }

  // Draw horizontal lines
  for (let i = 0; i < rows; i++) {
    const line = createLineSVG(false, i, "black", lineWidth);

    board.appendChild(line);
  }
}

export function drawStarPoints(board, rows, cols, starPointRadius = 3) {
  const starPoints = getStarPoints(rows, cols);

  starPoints.forEach((point) => {
    const starPoint = createCircleSVG(
      point.x,
      point.y,
      starPointRadius,
      "black"
    );
    board.appendChild(starPoint);
  });
}
