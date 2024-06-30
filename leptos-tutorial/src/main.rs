use leptos::*;

fn main() {
    console_error_panic_hook::set_once();
    mount_to_body(|| view! { <App/> })
}

#[component]
fn ProgressBar(
    #[prop(default = 100)] max: u16,
    //
    progress: impl Fn() -> i32 + 'static,
) -> impl IntoView {
    view! {
        <progress
            max=max
            value=progress
        />
    }
}

#[component]
fn App() -> impl IntoView {
    let (p, set_p) = create_signal(0);
    let double_p = move || p() * 2;

    view! {
        <button
            on:click=move |_| {
                set_p.update(|n| *n += 1);
            }
        >
            "Click to progress"
        </button>
        <br />

        <p>{format!("Progress bar without 'max' prop, defaulting to max=100: ")}</p>
        <ProgressBar progress=p/>
        <p>{format!("Progress bar with 'max=10' prop: ")}</p>
        <ProgressBar max=10 progress=p/>
        <p>{format!("Progress bar with double_p: ")}</p>
        <ProgressBar max=10 progress=double_p/>

        <br />
        <p>{format!("A line drawn with SVG:")}</p>
        <br />
        <svg height="300" width="300" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" x2="300" y1="0" y2="0" style="stroke:red;stroke-width:2" />
        </svg>

    }
}
