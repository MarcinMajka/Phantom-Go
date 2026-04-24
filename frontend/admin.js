import { createButton } from "./UI.js";
import { getGamesList, getGamesListAdmin } from "./handlers.js";
import { getElapsedTimeString } from "./utils.js";
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
  const ul = document.createElement("ul");
  gamesPanel.append(ul);

  for (const game of games) {
    const li = document.createElement("li");

    const elapsedText = getElapsedTimeString(game.last_move_time_elapsed);

    li.textContent = `Game: ${game.match_string} - Last move: ${elapsedText.join(", ")} ago.`;
    li.onclick = () => {
      fetchWithErrorHandling(`${API_URL}/validate-spectator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          match_string: game.match_string,
          session_token: getPlayerSessionToken(),
        }),
      }).then((data) => {
        console.log(data);
        const href = data.redirect_url + data.session_token;
        console.log(href);
        window.location.href = href;
      });
    };
    ul.appendChild(li);
  }
});
