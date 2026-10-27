import bleach
from bleach.css_sanitizer import CSSSanitizer
import cssutils
from bs4 import BeautifulSoup
import nh3
import re

# Silence cssutils logs
cssutils.log.setLevel("ERROR")

SAFE_CSS_PROPERTIES = {
    "color",
    "background-color",
    "text-align",
    "font-family",
    "text-decoration",  # for <u> styles or
    "font-weight",
    "font-size",
}

UNSAFE_VALUE_PATTERN = re.compile(r"expression|javascript:", re.IGNORECASE)


def sanitize_style_attr(style_str):
    parsed = cssutils.parseStyle(style_str)
    clean = cssutils.css.CSSStyleDeclaration()
    for prop in parsed:
        if prop.name in SAFE_CSS_PROPERTIES and not UNSAFE_VALUE_PATTERN.search(
            prop.value
        ):
            clean[prop.name] = prop.value
    return clean.cssText.replace("\n", " ")


def preprocess_styles(html):
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script"]):
        tag.decompose()  # completely remove tag and contents

    for tag in soup.find_all(True):
        if tag.has_attr("style"):
            cleaned = sanitize_style_attr(tag["style"])
            if cleaned:
                tag["style"] = cleaned
            else:
                del tag["style"]
    return str(soup)


def sanitize_html(dirty_html):
    allowed_tags = list(bleach.sanitizer.ALLOWED_TAGS) + [
        "div",
        "span",
        "mark",
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "b",
        "i",
        "strong",
        "em",
        "u",
        "hr",
        "u",
        "ol",
        "ul",
        "li",
        "sub",
        "sup",
    ]
    allowed_attrs = {"*": ["style"]}

    css_sanitizer = CSSSanitizer(allowed_css_properties=list(SAFE_CSS_PROPERTIES))
    cleaned_input = preprocess_styles(dirty_html)

    return bleach.clean(
        cleaned_input,
        tags=allowed_tags,
        attributes=allowed_attrs,
        strip=True,
        css_sanitizer=css_sanitizer,
    )


def sanitize_json_values(value):
    """Return parsed JSON with every string key and value passed through nh3.

    Each string is its own HTML fragment, so it is cleaned on its own. Cleaning the
    serialized text instead lets nh3 rewrite markup across a string's quotes -- a
    link's href="..." comes back with bare double quotes, which no longer parses.
    """
    if isinstance(value, str):
        return nh3.clean(value)
    if isinstance(value, list):
        return [sanitize_json_values(item) for item in value]
    if isinstance(value, dict):
        return {
            nh3.clean(key): sanitize_json_values(item) for key, item in value.items()
        }
    return value
