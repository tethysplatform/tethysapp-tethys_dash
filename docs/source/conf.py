# Configuration file for the Sphinx documentation builder.
import os
import tomllib as toml

# -- Project information
pyproject_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../pyproject.toml'))
with open(pyproject_path, 'rb') as f:
    pyproject = toml.load(f)
project_version = pyproject['project']['version']

project = "TethysDash"
copyright = "2024, Aquaveo"
author = "Corey Krewson"

release = '.'.join(project_version.split('.')[:2])
version = project_version

# -- General configuration

extensions = [
    "sphinx.ext.duration",
    "sphinx.ext.doctest",
    "sphinx.ext.autodoc",
    "sphinx.ext.autosummary",
    "sphinx.ext.intersphinx",
    "sphinxcontrib.video",
]

intersphinx_mapping = {
    "python": ("https://docs.python.org/3/", None),
    "sphinx": ("https://www.sphinx-doc.org/en/master/", None),
}
intersphinx_disabled_domains = ["std"]

templates_path = ["_templates"]

html_static_path = ["../static"]
html_css_files = [
    "css/custom.css",
]

# -- Options for HTML output

html_theme = "sphinx_rtd_theme"

# -- Options for EPUB output
epub_show_urls = "footnote"
