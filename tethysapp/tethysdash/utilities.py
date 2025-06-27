import bleach
from bleach.css_sanitizer import CSSSanitizer
import cssutils
from bs4 import BeautifulSoup
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
