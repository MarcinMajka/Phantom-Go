import {
  createButton,
  updateTurn,
  showStonesInAtari,
  toggleGroupSelection,
  groupsToRemove,
} from "./UI.js";
import {
  getAPIUrl,
  getMatchString,
  getPlayerColor,
  getPlayerSessionToken,
} from "./utils.js";
import { elements } from "./elements.js";

export let addingGuessStone = false;
export let removingGuessStone = false;

const API_URL = getAPIUrl();
const playerColor = getPlayerColor();

export let boardState = [];

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
  // TODO: this has to check if both players clicked the button - if yes, then both should get the score,
  // TODO: if no, then wait for other player - if deadGroupsDuringCounting changes, it resets the flag on player clicking the button
  fetch(`${API_URL}/get-score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      match_string: getMatchString(),
      session_token: getPlayerSessionToken(),
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
    })
    .catch((error) => {
      console.error("Error during count score:", error);
    });
}

export function downloadSGFButtonHandler() {
  if (elements.downloadSGF) {
    elements.downloadSGF.addEventListener("click", downloadSGFRequest);
  }
}

async function downloadSGFRequest() {
  const match_string = getMatchString();
  fetch(`${API_URL}/get-game-record`, {
    method: "POST",
    headers: {
      "Content-type": "application/json",
    },
    body: JSON.stringify({ match_string }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      console.log(response);
      return response.text();
    })
    .then((data) => {
      console.log(data);
      const link = document.createElement("a");
      const blob = new Blob([data], { type: "text/plain" });

      link.href = URL.createObjectURL(blob);
      link.download = `${match_string}.sgf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
}

export function goToMainBoardButtonHandler() {
  if (elements.mainBoardLink) {
    elements.mainBoardLink.addEventListener("click", () => {
      window.location.href = "/frontend/main.html?match=" + getMatchString();
    });
  }
}

export function passButtonHandler() {
  if (elements.pass) {
    elements.pass.addEventListener("click", passRequest);
  }
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
  if (elements.guessStone) {
    elements.guessStone.addEventListener("click", () => {
      console.log("Add stone button clicked");
      elements.guessStone.classList.toggle("clicked");
      if (elements.guessStone.classList.contains("clicked")) {
        addingGuessStone = true;
        removingGuessStone = true;
      } else {
        addingGuessStone = false;
        removingGuessStone = false;
      }
    });
  }
}

export function getGroupRequest(row, col) {
  fetch(`${API_URL}/get-group`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      frontend_board: "main",
      row: parseInt(row),
      col: parseInt(col),
      match_string: getMatchString(),
      session_token: getPlayerSessionToken(),
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Server response:", data);

      toggleGroupSelection(data);
      return data;
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
