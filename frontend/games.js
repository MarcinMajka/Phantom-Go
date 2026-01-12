import { getGamesList } from "./handlers.js";

document.addEventListener("DOMContentLoaded", async () => {
  console.log(await getGamesList());
});
