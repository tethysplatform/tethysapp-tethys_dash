import pytest
from tethysapp.tethysdash.utilities import (
    sanitize_style_attr,
    preprocess_styles,
    sanitize_html,
)

# --- Tests for sanitize_style_attr ---


@pytest.mark.parametrize(
    "input_style,expected_output",
    [
        ("color: red; font-weight: bold;", "color: red; font-weight: bold"),
        ("position: absolute; color: blue;", "color: blue"),
        (
            "background-color: yellow; text-align: center;",
            "background-color: yellow; text-align: center",
        ),
        ("color: expression(alert('xss'));", ""),  # blocked unsafe value
        (
            "font-family: 'Arial'; font-size: 12px;",
            'font-family: "Arial"; font-size: 12px',
        ),
    ],
)
def test_sanitize_style_attr(input_style, expected_output):
    result = sanitize_style_attr(input_style)
    assert result == expected_output


# --- Tests for preprocess_styles ---


def test_preprocess_styles_removes_unsafe_styles():
    html = '<div style="position: fixed; color: blue;">Test</div>'
    result = preprocess_styles(html)
    assert "position" not in result
    assert "color: blue" in result


def test_preprocess_styles_removes_style_if_empty():
    html = '<span style="position: absolute;">Text</span>'
    result = preprocess_styles(html)
    assert "style=" not in result


# --- Tests for sanitize_html ---


def test_sanitize_html_allows_safe_tags_and_styles():
    dirty = '<div style="color: red;">Hello <strong>world</strong></div>'
    result = sanitize_html(dirty)
    assert result == dirty


def test_sanitize_html_strips_disallowed_tags():
    dirty = '<script>alert("xss")</script><p style="font-weight: bold;">Safe</p>'
    result = sanitize_html(dirty)
    assert "<script>" not in result
    assert 'alert("xss")' not in result
    assert result == '<p style="font-weight: bold;">Safe</p>'


def test_sanitize_html_removes_unsafe_styles():
    dirty = '<span style="background-image: url(javascript:alert(1))">Bad style</span>'
    result = sanitize_html(dirty)
    assert "background-image" not in result
    assert "javascript" not in result
