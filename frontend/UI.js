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

export function handleGameButtonsAfterGame(isGameOver) {
  if (buttonsWereHandledAfterGame) return;

  buttonsWereHandledAfterGame = true;

  if (!isGameOver) {
    elements.countScore.style.visibility = "visible";
    if (elements.downloadSGF) {
      elements.downloadSGF.style.visibility = "visible";
    }
  }

  if (elements.mainBoardLink) {
    elements.mainBoardLink.style.visibility = "visible";
  }
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

export function toggleGroupSelection(groups) {
  const selected = groups.selected;
  const toggle = groups.toggle;
  console.log("THEY SAY TOGGLE IS NOT ITERABLE: ", toggle);
  const groupKey = JSON.stringify(toggle);

  for (const loc of toggle) {
    // checks if called from syncBoards(), so no toggle from the user happened
    if (loc.row == 100) continue;

    const stoneToColor = getStoneToColor(loc);
    const currentFill = stoneToColor.getAttribute("fill");

    if (currentFill === "transparent") {
      delete groupsToRemove[groupKey];

      const color = stoneToColor.getAttribute("data-color");
      stoneToColor.setAttribute("fill", color);
    } else {
      groupsToRemove[groupKey] = toggle;

      stoneToColor.setAttribute("fill", "transparent");
    }
  }

  for (const group of selected) {
    console.log("group.toString():");
    console.log(JSON.stringify(group));
    console.log("toggle.toString():");
    console.log(JSON.stringify(toggle));

    if (JSON.stringify(group) === JSON.stringify(toggle)) continue;

    for (const loc of group) {
      const stone = getStoneToColor(loc);
      stone.setAttribute("fill", "transparent");
    }
  }
}

function getStoneToColor(loc) {
  const [row, col] = [loc.row - 1, loc.col - 1];

  return boards.main.querySelector(
    `.stone[data-row="${row}"][data-col="${col}"]`
  );
}
