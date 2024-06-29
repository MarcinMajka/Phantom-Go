use leptos::*;

fn main() {
    console_error_panic_hook::set_once();
    mount_to_body(|| view! { <App/> })
}

#[component]
fn ProgressBar(progress: ReadSignal<i32>) -> impl IntoView {
    view! {
        <progress
            max="50"
            value=progress
        />
    }
}

#[component]
fn App() -> impl IntoView {
    let (x, set_x) = create_signal(0);
    let (p, set_p) = create_signal(0);

    view! {
        <button
            on:click=move |_| {
                set_x.update(|n| *n += 10);
            }

            style="position: absolute"

            style:left=move || format!("{}px", x() + 100)
            style:background-color=move || format!("rgb({}, {}, 100)", x(), 100)
            style:max-width="400px"

            style=("--columns", x)
        >
            "Click to move"
        </button>
        <br />
        <button
            on:click=move |_| {
                set_p.update(|n| *n += 1);
            }
        >
            "Click to progress"
        </button>
        <br />

        <ProgressBar progress=p/>
    }
}
