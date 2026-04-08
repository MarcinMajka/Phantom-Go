import { getGamesList } from "./handlers.js";
import {
  fetchWithErrorHandling,
  getAPIUrl,
  getPlayerSessionToken,
} from "./utils.js";

const API_URL = getAPIUrl();

document.addEventListener("DOMContentLoaded", async () => {
  const games = await getGamesList();

  const gamesPanel = document.getElementById("games-panel");
  const ul = document.createElement("ul");
  gamesPanel.append(ul);

  for (const game of games) {
    const li = document.createElement("li");
    li.textContent = game;
    li.onclick = () => {
      fetchWithErrorHandling(`${API_URL}/validate-spectator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          match_string: game,
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
