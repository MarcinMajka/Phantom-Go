import {
  elements,
  createButton,
  updateTurn,
  updateCaptures,
  showStonesInAtari,
} from "./UI.js";
import { getAPIUrl, getMatchString, getPlayerColor } from "./utils.js";
import { groupsToRemove, updateBoard } from "./script.js";

export let addingGuessStone = false;
export let removingGuessStone = false;

const API_URL = getAPIUrl();
const playerColor = getPlayerColor();

export function resignButtonHandler() {
  if (elements.resign) {
    elements.resign.addEventListener("click", resignRequest);
  }
}

function resignRequest() {
  fetch(`${API_URL}/resign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      match_string: getMatchString(),
      player: playerColor,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Resign response:", data);
      const res = createButton("resign-result", data.winner + " + R");
      elements.infoContainer.innerHTML = "";
      elements.infoContainer.appendChild(res);
    })
    .catch((error) => {
      console.error("Error during resign:", error);
    });
}

export function countScoreButtonHandler() {
  elements.countScore.addEventListener("click", countScoreRequest);
}

function countScoreRequest() {
  fetch(`${API_URL}/get-score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      match_string: getMatchString(),
      groups_to_remove: Object.values(groupsToRemove),
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Result:", data);
      const res = createButton("result", `Result: ${data}`);
      elements.infoContainer.innerHTML = "";
      elements.infoContainer.appendChild(res);

      // updateBoard(boardState);
      // updateCaptures(data.black_captures, data.white_captures);
      // updateTurn(data.current_player);
    })
    .catch((error) => {
      console.error("Error during count score:", error);
    });
}

export function passButtonHandler() {
  elements.pass.addEventListener("click", passRequest);
}

function passRequest() {
  fetch(`${API_URL}/pass`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      match_string: getMatchString(),
      player: playerColor,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Pass response:", data.message);
      if (data.message === "It's not your turn to pass!") {
        return;
      }
      showStonesInAtari({ black: 0, white: 0 });
      updateTurn(data.current_player);
    })
    .catch((error) => {
      console.error("Error during pass:", error);
    });
}

export function guessStonesButtonsHandler() {
  if (elements.addStone) {
    elements.addStone.addEventListener("click", () => {
      console.log("Add stone button clicked");
      elements.addStone.classList.toggle("clicked");
      if (elements.addStone.classList.contains("clicked")) {
        addingGuessStone = true;
      } else {
        addingGuessStone = false;
      }
    });
  }

  if (elements.removeStone) {
    elements.removeStone.addEventListener("click", () => {
      console.log("Remove stone button clicked");
      elements.removeStone.classList.toggle("clicked");
      if (elements.removeStone.classList.contains("clicked")) {
        removingGuessStone = true;
      } else {
        removingGuessStone = false;
      }
    });
  }
}

export function undoButtonHandler(boardState) {
  elements.undo.addEventListener("click", () => {
    undoRequest(boardState);
  });
}

function undoRequest(boardState) {
  fetch(`${API_URL}/undo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      match_string: getMatchString(),
      player: playerColor,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Server response:", data.message);
      if (data.message === "It's not your turn to undo!") {
        return;
      }
      boardState = data.board;
      updateBoard(boardState, data.stones_in_atari);
      updateCaptures(data.black_captures, data.white_captures);
      updateTurn(data.current_player);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
