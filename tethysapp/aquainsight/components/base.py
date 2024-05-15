from reactpy import component, html


@component
def app_navigation_items(path):
    return html.div(
        html.li({'class_name': 'nav-item title'}, 'App Navigation'),
        html.li({'class_name': 'nav-item active'}, html.a({'class_name': 'nav-link', 'href': ''}, 'Home')),
        html.li({'class_name': 'nav-item'}, html.a({'class_name': 'nav-link', 'href': ''}, 'Jobs')),
        html.li({'class_name': 'nav-item'}, html.a({'class_name': 'nav-link', 'href': ''}, 'Results')),
        html.li({'class_name': 'nav-item title'}, 'Steps'),
        html.li({'class_name': 'nav-item'}, html.a({'class_name': 'nav-link', 'href': ''}, '1. The First Step')),
        html.li({'class_name': 'nav-item'}, html.a({'class_name': 'nav-link', 'href': ''}, '2. The Second Step')),
        html.li({'class_name': 'nav-item'}, html.a({'class_name': 'nav-link', 'href': ''}, '3. The Third Step')),
        html.li({'class_name': 'nav-item separator'}, ''),
        html.li({'class_name': 'nav-item'}, html.a({'class_name': 'nav-link', 'href': ''}, 'Get Started')),
    )