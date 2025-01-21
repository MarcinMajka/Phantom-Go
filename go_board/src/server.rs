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
    pub row: usize,
    pub col: usize,
}

#[derive(Serialize)]
struct GameState {
    message: String,
    board: Vec<Vec<String>>,
    current_player: String,
}

static mut GAME_BOARD: Option<Board> = None;

// Initialize the game board
fn init_game() {
    unsafe {
        if GAME_BOARD.is_none() {
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

#[handler]
async fn get_dimensions() -> Json<BoardDimensions> {
    init_game();
    Json(BoardDimensions {
        rows: 9,
        cols: 9,
    })
}

#[handler]
async fn cell_click(payload: Json<CellClick>) -> Json<GameState> {
    unsafe {
        let board = GAME_BOARD.as_mut().unwrap();
        let current_player = board.get_current_player();
        
        // Create move from payload
        let move_attempt = Move {
            player: current_player,
            loc: Loc { row: payload.row, col: payload.col },
        };

        // Try to play the move - play() handles validation internally
        board.play(&move_attempt);
        
        // Convert board state to string format for frontend
        let board_state = board.fields.iter()
            .map(|row| {
                row.iter()
                    .map(|&color| color_to_string(color))
                    .collect()
            })
            .collect();

        Json(GameState {
            message: format!("Move attempted at ({}, {})", payload.row, payload.col),
            board: board_state,
            current_player: player_to_string(board.get_current_player()),
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
        .with(cors);

    println!("Server running at http://127.0.0.1:8000");
    Server::new(TcpListener::bind("127.0.0.1:8000"))
        .run(app)
        .await
}