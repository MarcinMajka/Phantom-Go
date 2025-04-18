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
};

export function updateTurn(currentPlayer) {
  if (currentPlayer === "counting") {
    elements.turn.innerText = "Counting points";
    countingPhase = true;
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
