use leptos::*;

fn main() {
    console_error_panic_hook::set_once();
    mount_to_body(|| view! { <App/> })
}

#[component]
fn App() -> impl IntoView {
    let vector = vec![0, 1, 2];

    view! {
        <p>{format!("A line drawn with SVG:")}</p>
        <br />
        <svg height="300" width="300" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" x2="300" y1="0" y2="0" style="stroke:red;stroke-width:2" />
        </svg>
        <p>{format!("A Vec:")}</p>
        <p>{vector.clone()}</p>
        <p>{format!("Vec elements one by one:")}</p>
        <ul>
            {vector.into_iter()
                .map(|n| view! {<li>{n}</li>})
                .collect::<Vec::<_>>()
            }
        </ul>
    }
}
