use axum::{
    extract::{Path, Query},
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use rand::{thread_rng, Rng};
use serde::Deserialize;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    let routes_both = Router::new()
        .route("/rng", get(handler_rng))
        .route("/hello", get(handler_hello))
        .route("/hello2/:name", get(handler_hello2));

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on {addr}");
    axum::Server::bind(&addr)
        .serve(routes_both.into_make_service())
        .await
        .unwrap();
}

#[derive(Debug, Deserialize)]
struct RangeParameters {
    start: usize,
    end: usize,
}

async fn handler_rng(Query(range): Query<RangeParameters>) -> Html<String> {
    println!("->> {:<12} - handler_hello - {range:?}", "HANDLER");
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
    println!("->> {:<12} - handler_hello - {name:?}", "HANDLER");
    Html(format!("Hello <strong>{name}</strong>"))
}
