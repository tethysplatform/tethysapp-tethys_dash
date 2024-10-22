import os

# NOTE: database user given must be a superuser to successfully execute all tests.
default_connection = "postgresql://postgres:pass@localhost:5435/test_tethysdash"
TEST_DB_URL = os.environ.get(
    "TETHYSDASH_TEST_DATABASE", default_connection
)  # noqa: F401, F403
