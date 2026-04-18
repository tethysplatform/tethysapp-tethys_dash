"""MCP contract test configuration.

Overrides the parent conftest.py's autouse database fixtures so MCP contract
tests can run without a database connection.  MCP tool functions are pure
Python — they take parameters and return dicts — so no DB is needed.

The parent's fixture chain is:
    truncate_tables(db_session, db_url)   [autouse]
        → db_session(session_maker)
            → session_maker(db_connection)
                → db_connection(db_engine_and_migrate)
                    → db_engine_and_migrate(db_url)
                        → db_url

Redefining `truncate_tables` with no parameters short-circuits the chain for
the normal case.  We also override every link in the chain with a no-op so
that any future test (or fixture added to a parent conftest) that explicitly
requests one of them still gets a safe value instead of cascading a None
engine into `.connect()`.
"""

import pytest


# ---------------------------------------------------------------------------
# Override inherited autouse fixtures from ../conftest.py
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


@pytest.fixture
def db_connection(db_engine_and_migrate):
    """No-op — MCP contract tests never touch the DB."""
    yield None


@pytest.fixture
def session_maker(db_connection):
    """No-op — MCP contract tests never open a session."""
    yield None


@pytest.fixture
def db_session(session_maker):
    """No-op — MCP contract tests never open a session."""
    yield None
