use crate::model::ModelController;

pub use self::error::{Error, Result};

use axum::{
    extract::{Path, Query},
    middleware,
    response::{Html, IntoResponse, Response},
    routing::{get, get_service},
    Router,
};
use rand::{thread_rng, Rng};
use serde::Deserialize;
use std::net::SocketAddr;
use tower_cookies::CookieManagerLayer;
use tower_http::services::ServeDir;

mod ctx;
mod error;
mod model;
mod web;

#[tokio::main]
async fn main() -> Result<()> {
    let mc = ModelController::new().await?;

    let routes_apis = web::routes_tickets::routes(mc.clone())
        .route_layer(middleware::from_fn(web::mw_auth::mw_require_auth));

    let routes_all = Router::new()
        .merge(routes_hellos())
        .merge(routes_rng())
        .merge(web::routes_login::routes())
        .nest("/api", routes_apis)
        // Layers get executed from bottom to top
        // If we want the cookie layer data in all middlewares, CookieManagerLayer has to be last
        .layer(middleware::map_response(main_response_mapper))
        .layer(CookieManagerLayer::new())
        .fallback_service(routes_static());

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on {addr}");
    axum::Server::bind(&addr)
        .serve(routes_all.into_make_service())
        .await
        .unwrap();

    Ok(())
}

fn routes_hellos() -> Router {
    Router::new()
        .route("/hello", get(handler_hello))
        .route("/hello2/:name", get(handler_hello2))
}

fn routes_rng() -> Router {
    Router::new().route("/rng", get(handler_rng))
}

fn routes_static() -> Router {
    Router::new().nest_service("/", get_service(ServeDir::new("./")))
}

async fn main_response_mapper(res: Response) -> Response {
    println!("->> {:<12} - main_response_mapper", "RES_MAPPER");

    println!();
    res
}

#[derive(Debug, Deserialize)]
struct RangeParameters {
    start: usize,
    end: usize,
}

async fn handler_rng(Query(range): Query<RangeParameters>) -> Html<String> {
    println!("->> {:<12} - handler_rng - {range:?}", "HANDLER");
    let random_number = thread_rng().gen_range(range.start..=range.end);
    let html_template = include_str!("../../index.html");
    let response_html = html_template
        .replace("{{start}}", &range.start.to_string())
        .replace("{{end}}", &range.end.to_string())
        .replace("{{random_number}}", &random_number.to_string());
    Html(response_html)
}

#[derive(Debug, Deserialize)]
struct HelloParams {
    name: Option<String>,
}

async fn handler_hello(Query(params): Query<HelloParams>) -> impl IntoResponse {
    println!("->> {:<12} - handler_hello - {params:?}", "HANDLER");
    // params.name is Option<String>, as_deref() returns Option<&str>, so we can use unwrap_or() for default value
    let name = params.name.as_deref().unwrap_or("Wordlasdfdstgr...");
    Html(format!("Hello <strong>{name}</strong>"))
}

async fn handler_hello2(Path(name): Path<String>) -> impl IntoResponse {
    println!("->> {:<12} - handler_hello2 - {name:?}", "HANDLER");
    Html(format!("Hello <strong>{name}</strong>"))
}
