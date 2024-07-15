from reactpy import component, html


@component
def app_content():
    return html.div(
        html.h1("Welcome to your Tethys App!"),
        html.p(
            "Take advantage of beautiful typography to organize the content of your app:"
        ),
        html.h1("Heading 1"),
        html.h2("Heading 2"),
        html.h3("Heading 3"),
        html.h4("Heading 4"),
        html.h5("Heading 5"),
        html.h6("Heading 6"),
    )


@component
def after_app_content():
    modal_header = html.div(
        {"class_name": "modal-header"},
        html.h5(
            {"class_name": "nav-item title", "id": "help-modal-label"}, "Example Modal"
        ),
        html.button(
            {
                "class_name": "btn-close",
                "data-bs-dismiss": "modal",
                "aria-label": "Close",
            }
        ),
    )

    modal_body = html.div(
        {"class_name": "modal-body"},
        html.p(
            "You can add custom buttons to the app header using the ",
            html.code("header_buttons"),
            " block. Use anchor/link tags for the button and wrap it in a div with the class ",
            html.code("header-button"),
            ". For buttons with the gliphyicons, add the ",
            html.code("glyphicon-button"),
            " class as well.",
        ),
        html.p(
            "Ever have trouble using a modal in a Tethys app? Use the ",
            html.code("after_app_content"),
            " block for modal content to allow them to function properly. See: ",
            html.a(
                {"href": "https://getbootstrap.com/docs/5.1/components/modal/"},
                "Bootstrap Modals",
            ),
        ),
        html.p(
            "Add tooltips to any element by adding the ",
            html.code("data-bs-toggle"),
            ", ",
            html.code("data-bs-placement"),
            ", and ",
            html.code("title"),
            " attributes to the button. See: ",
            html.a(
                {"href": "https://getbootstrap.com/docs/5.1/components/tooltips/"},
                "Bootstrap Tooltips",
            ),
        ),
    )

    modal_footer = html.div(
        {"class_name": "modal-footer"},
        html.button(
            {"class_name": "btn btn-secondary", "data-bs-dismiss": "modal"}, "Cancel"
        ),
        html.button(
            {"class_name": "btn btn-primary", "data-bs-dismiss": "modal"}, "OK"
        ),
    )

    modal_content = html.div(
        {"class_name": "modal-content"}, modal_header, modal_body, modal_footer
    )

    modal_dialog = html.div(
        {"class_name": "modal-dialog", "role": "document"}, modal_content
    )

    modal = html.div(
        {
            "class_name": "modal fade",
            "id": "help-modal",
            "tabindex": "-1",
            "role": "dialog",
            "aria-labelledby": "help-modal-label",
        },
        modal_dialog,
    )

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
