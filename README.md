# Phantom Go Game

This is a web-based Phantom Go game with a Rust backend and a JavaScript frontend.

## Getting Started

1. **Clone the repository:**

   ```sh
   git clone git@github.com:MarcinMajka/Phantom-Go.git
   cd phantom-go
   ```

2. **Configure environment (optional):**

   - Copy the environment template:
     ```sh
     cp env.template .env
     ```
   - Edit `.env` to customize settings like the frontend origin for CORS:
     ```
     FRONTEND_ORIGIN=http://127.0.0.1:5501
     ```
   - If no `.env` file is provided, the server will use default values.

3. **Start the backend server:**

   - Open a terminal in the `go_board` directory:
     ```sh
     cd go_board
     cargo run
     ```
   - This will start the Rust backend server on `http://localhost:8000`.

4. **Start the frontend:**

   - Open the `frontend/index.html` file in VS Code.
   - Use the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension to launch a local server for the frontend.
   - The frontend will be available at `http://127.0.0.1:5501/frontend/index.html` (or similar, depending on your Live Server settings).

5. **Play the game:**
   - Open the frontend URL in your browser.
   - Join or create a game using a match string.

## Requirements

- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/) (optional, only for Live Server if not using VS Code)
- [VS Code Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)

## Notes

- The backend runs on `localhost:8000`.
- The frontend communicates with the backend via HTTP requests.
- For development, keep both the backend and frontend servers running.
- Environment files (`.env`) are gitignored for security.

## Deployment

- Deployment is automatic - just push to `production` branch
