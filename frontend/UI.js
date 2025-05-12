export let countingPhase = false;

export const elements = {
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
  infoContainer: document.getElementById("info-container"),
};

elements.countScore.style.visibility = "hidden";

export function updateTurn(currentPlayer) {
  if (currentPlayer === "counting") {
    elements.turn.innerText = "Counting points";
    countingPhase = true;
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
