use poem::{
    middleware::Cors,
    handler,
    listener::TcpListener,
    web::{ Json, Query },
    EndpointExt, Route, Server, Result
};
use serde::{Serialize, Deserialize};

#[derive(Serialize)]
struct BoardDimensions {
    rows: usize,
    cols: usize,
}

#[handler]
async fn get_dimensions() -> Json<BoardDimensions> {
    Json(BoardDimensions {
        rows: 19,  // These values match your Board::new(7, 7, 1.5)
        cols: 19,
    })
}

#[derive(Deserialize)]
pub struct CellCheckQuery {
    pub row: usize,
    pub col: usize,
}

#[derive(Serialize)]
pub struct CellCheckResponse {
    pub is_empty: bool,
}

#[handler]
async fn cell_check(query: Query<CellCheckQuery>) -> Result<Json<CellCheckResponse>> {
    let row = query.row;
    let col = query.col;
    
    // All fields empty, except tengen
    let is_empty: bool = {
        if row == 9 && col == 9 {
            false
        } else {
            true
        }
    };

    Ok(Json(CellCheckResponse { is_empty }))
}


#[derive(Deserialize, Debug)]
pub struct CellClick {
    pub row: usize,
    pub col: usize,
}

#[derive(Serialize)]
struct Response {
    message: String,
}

#[handler]
async fn cell_click(payload: Json<CellClick>) -> Json<Response> {
    println!("Received payload: row = {}, col = {}", payload.row, payload.col);

    Json(Response {
        message: format!("Move registered at ({}, {})", payload.row, payload.col),
    })
}


pub async fn start_server() -> Result<(), std::io::Error> {
    let cors = Cors::new()
        .allow_origin("http://127.0.0.1:5501") // Allow the frontend origin
        .allow_methods(vec!["POST", "GET"])
        .allow_headers(vec!["Content-Type"]); // Allow Content-Type header

    let app = Route::new()
        .at("/cell-click", poem::post(cell_click))
        .at("/cell-check", poem::get(cell_check))
        .at("/dimensions", poem::get(get_dimensions))
        .with(cors);

    println!("Server running at http://127.0.0.1:8000");
    Server::new(TcpListener::bind("127.0.0.1:8000"))
        .run(app)
        .await
}
