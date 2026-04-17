"""MCP contract test configuration.

Overrides the parent conftest.py's autouse database fixtures so MCP contract
tests can run without a database connection.  MCP tool functions are pure
Python — they take parameters and return dicts — so no DB is needed.
"""

import pytest


# ---------------------------------------------------------------------------
# Override inherited autouse fixtures from ../conftest.py
# The parent's truncate_tables is autouse=True and pulls in the full
# db_session → db_engine_and_migrate → db_url chain.  Redefining it here
# with no parameters short-circuits that chain for all tests under mcp/.
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def truncate_tables():
    """No-op — MCP contract tests don't use a database."""


@pytest.fixture(scope="session")
def db_url():
    """No-op — prevents parent session-scoped DB setup."""
    return "sqlite:///unused"


@pytest.fixture(scope="session")
def db_engine_and_migrate(db_url):
    """No-op — prevents parent DB engine creation and Alembic migrations."""
    yield None
