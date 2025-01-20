use poem::{
    middleware::Cors,
    handler,
    listener::TcpListener,
    web::Json,
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
        rows: 9,
        cols: 9,
    })
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
        .at("/dimensions", poem::get(get_dimensions))
        .with(cors);

    println!("Server running at http://127.0.0.1:8000");
    Server::new(TcpListener::bind("127.0.0.1:8000"))
        .run(app)
        .await
}
