import {
  createLineSVG,
  createCircleSVG,
  getStarPoints,
  getMatchString,
} from "./utils.js";
import { boards, elements } from "./elements.js";

export const groupsToRemove = {};

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

  if (!isGameOver) {
    elements.countScore.style.visibility = "visible";
    if (elements.downloadSGF) {
      elements.downloadSGF.style.visibility = "visible";
    }
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

export function toggleGroupSelection(group) {
  const groupKey = JSON.stringify(group);

  for (const loc of group) {
    const [row, col] = [loc.row - 1, loc.col - 1];
    console.log(`Changing color of: ${row} - ${col} stone`);

    const stoneToColor = boards.main.querySelector(
      `.stone[data-row="${row}"][data-col="${col}"]`
    );

    const color = stoneToColor.getAttribute("data-color");
    const currentFill = stoneToColor.getAttribute("fill");

    if (currentFill === "transparent") {
      delete groupsToRemove[groupKey];
      stoneToColor.setAttribute("fill", color);
    } else {
      groupsToRemove[groupKey] = group;
      stoneToColor.setAttribute("fill", "transparent");
    }
  }
}
