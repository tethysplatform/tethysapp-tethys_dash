from reactpy import component, html


@component
def app_content():
    return html.div()


@component
def after_app_content():

    modal = html.div()

    return modal


@component
def header_buttons():
    return html.div(
        {
            "class_name": "header-button glyphicon-button",
            "data-bs-toggle": "tooltip",
            "data-bs-placement": "bottom",
            "title": "Help",
        },
        html.a(
            {"data-bs-toggle": "modal", "data-bs-target": "#help-modal"},
            html.i({"class_name": "bi bi-question-circle"}),
        ),
    )
