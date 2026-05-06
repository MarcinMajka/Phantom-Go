import { createButton } from "./UI.js";
import { getGamesList, getGamesListAdmin } from "./handlers.js";
import { createAdminGamesListNode, getElapsedTimeArray } from "./utils.js";
import {
  fetchWithErrorHandling,
  getAPIUrl,
  getPlayerSessionToken,
} from "./utils.js";

console.log("You opened the Admin Panel!");
// Detect if running locally and set API URL accordingly
const API_URL = getAPIUrl();

// TODO: investigate how to make this panel password protected
// TODO: show list of active games, with additional info (game status + time elapsed from last move)

const resetButton = createButton("admin-button", "Reset backend memory", () => {
  fetch(`${API_URL}/reset-memory`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (response.ok) {
        alert("Backend memory reset successfully!");
      } else {
        alert("Failed to reset backend memory.");
      }
    })
    .catch((error) => {
      console.error("Error resetting backend memory:", error);
      alert("Error resetting backend memory.");
    });
});

document.getElementById("admin-panel").appendChild(resetButton);

document.addEventListener("DOMContentLoaded", async () => {
  const games = await getGamesListAdmin();

  const gamesPanel = document.getElementById("games-panel");

  for (const game of games) {
    const g = createAdminGamesListNode(
      game.match_string,
      game.last_move_time_elapsed,
      "DELETE",
    );
    console.log(g);
    gamesPanel.appendChild(g);
  }
});
