use poem::{
    middleware::Cors,
    handler,
    listener::TcpListener,
    web::Json,
    EndpointExt, Route, Server, Result
};
use serde::{Serialize, Deserialize};
use crate::board::{Board, Move, Loc, Player, Color};

#[derive(Serialize)]
struct BoardDimensions {
    rows: usize,
    cols: usize,
}

#[derive(Deserialize, Debug)]
pub struct CellClick {
    pub frontend_board: String,
    pub row: usize,
    pub col: usize,
}

#[derive(Serialize)]
struct GameState {
    message: String,
    board: Vec<Vec<String>>,
    black_player_board: Vec<Vec<String>>,
    white_player_board: Vec<Vec<String>>,
    current_player: String,
    black_captures: isize,
    white_captures: isize,
}

static mut GAME_BOARD: Option<Board> = None;

// Initialize the game board
fn init_game() {
    unsafe {
        if GAME_BOARD.is_none() {
            // Actual board + sentinels
            GAME_BOARD = Some(Board::new(9, 9, 1.5));
        }
    }
}

fn color_to_string(color: Color) -> String {
    match color {
        Color::Empty => "empty".to_string(),
        Color::Black => "black".to_string(),
        Color::White => "white".to_string(),
        Color::Invalid => "invalid".to_string(),
    }
}

fn player_to_string(player: Player) -> String {
    match player {
        Player::Black => "black".to_string(),
        Player::White => "white".to_string(),
    }
}

fn get_playable_dimensions(board: &Board) -> (usize, usize) {
    let total_rows = board.fields.len();
    let total_cols = board.fields[0].len();
    // Subtract 2 from each dimension to account for sentinels
    (total_rows - 2, total_cols - 2)
}

#[handler]
async fn get_dimensions() -> Json<BoardDimensions> {
    unsafe {
        let board = GAME_BOARD.as_ref().unwrap();
        let (rows, cols) = get_playable_dimensions(board);
        Json(BoardDimensions { rows, cols })
    }
}

// Convert board state to string format for frontend, excluding sentinel borders
fn get_board_state(board: &Board) -> Vec<Vec<String>> {
    let (rows, cols) = get_playable_dimensions(board);
    board.fields[1..=rows].iter()
        .map(|row| {
            row[1..=cols].iter()
                .map(|&color| color_to_string(color))
                .collect()
        })
        .collect()
}

// Core communication pattern:
// 1. Receive click coordinates
// 2. Validate move
// 3. Update game state
// 4. Return updated game state to frontend
#[handler]
async fn cell_click(payload: Json<CellClick>) -> Json<GameState> {
    unsafe {
        let board = GAME_BOARD.as_mut().unwrap();
        let current_player = board.get_current_player();
        // Check if the move was made on correct player's board
        let frontend_board = payload.frontend_board.clone();
        let board_state: Vec<Vec<String>> = get_board_state(board);

        let correct_board = match current_player {
            Player::Black => "black",
            Player::White => "white",
        };

        if correct_board != frontend_board && frontend_board != "main" {
            return Json(GameState {
                message: format!("It's not your turn!"),
                board: board_state.clone(),
                black_player_board: board_state.clone(),
                white_player_board: board_state,
                current_player: player_to_string(board.get_current_player()),
                black_captures: board.get_black_captures(),
                white_captures: board.get_white_captures(),
            });
        }
        
        // Create move from payload
        let move_attempt = Move {
            player: current_player,
            loc: Loc { 
                // Add 1 to skip sentinel border
                row: payload.row + 1,
                col: payload.col + 1,
            },
        };

        // Try to play the move - play() handles validation internally
        board.play(&move_attempt);
        
        let board_state: Vec<Vec<String>> = get_board_state(board);
        
        Json(GameState {
            message: format!("Move attempted at ({}, {})", payload.row, payload.col),
            board: board_state.clone(),
            black_player_board: board_state.clone(),
            white_player_board: board_state,
            current_player: player_to_string(board.get_current_player()),
            black_captures: board.get_black_captures(),
            white_captures: board.get_white_captures(),
        })
    }
}

// Returns clicked group of stones during counting
#[handler]
async fn group_remove(payload: Json<CellClick>) -> Json<Vec<Loc>> {
    unsafe {
        let board = GAME_BOARD.as_mut().unwrap();
        let group = board.group_stones(Loc { row: payload.row + 1, col: payload.col + 1 });

        Json(group)
    }
}


#[handler]
async fn pass() -> Json<GameState> {
    unsafe {
        let board = GAME_BOARD.as_mut().unwrap();

        board.play(&Move {
            player: board.get_current_player(),
            loc: Loc::pass(),
        });

        let game_is_over = board.last_two_moves_are_pass();

        if !game_is_over {
            Json(GameState {
                message: format!("Player {:?} passed", board.get_current_player().opponent()),
                board: vec![],
                black_player_board: vec![],
                white_player_board: vec![],
                current_player: player_to_string(board.get_current_player()),
                black_captures: board.get_black_captures(),
                white_captures: board.get_white_captures(),
            })
        } else {
            Json(GameState {
            message: format!("Both players passed. Game over!"),
            board: vec![],
            black_player_board: vec![],
            white_player_board: vec![],
            current_player: "counting".to_string(),
            black_captures: board.get_black_captures(),
            white_captures: board.get_white_captures(),
        })
        }

        
    }
}

#[handler]
async fn undo() -> Json<GameState> {
    unsafe {
        let board = GAME_BOARD.as_mut().unwrap();
        board.undo();
        
        // Get the playable board dimensions
        let (rows, cols) = get_playable_dimensions(board);
        
        // Convert board state to string format for frontend, excluding sentinel borders
        let board_state: Vec<Vec<String>> = board.fields[1..=rows].iter()
            .map(|row| {
                row[1..=cols].iter()
                    .map(|&color| color_to_string(color))
                    .collect()
            })
            .collect();

        Json(GameState {
            message: "Undo successful".to_string(),
            board: board_state.clone(),
            black_player_board: board_state.clone(),
            white_player_board: board_state,
            current_player: player_to_string(board.get_current_player()),
            black_captures: board.get_black_captures(),
            white_captures: board.get_white_captures(),
        })
    }
}

pub async fn start_server() -> Result<(), std::io::Error> {
    init_game();

    let cors = Cors::new()
        .allow_origin("http://127.0.0.1:5501") // Allow the frontend origin
        .allow_methods(vec!["POST", "GET"])
        .allow_headers(vec!["Content-Type"]); // Allow Content-Type header

    let app = Route::new()
        .at("/cell-click", poem::post(cell_click))
        .at("/dimensions", poem::get(get_dimensions))
        .at("/undo", poem::post(undo))
        .at("/pass", poem::post(pass))
        .at("/group-remove", poem::post(group_remove))
        .with(cors);

    println!("Server running at http://127.0.0.1:8000");
    Server::new(TcpListener::bind("127.0.0.1:8000"))
        .run(app)
        .await
}