from logging.config import fileConfig
import os

from sqlalchemy import engine_from_config, create_engine, pool
from sqlalchemy.exc import OperationalError

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = None

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def get_db_url():
    db_user = "postgres"
    db_pass = os.environ.get("POSTGRES_PASSWORD", "pass")
    db_host = os.environ.get("TETHYS_DB_HOST", "localhost")
    db_name = os.environ.get("TETHYSDASH_DB_NAME", "tethysdash_primary_db")
    db_port = os.environ.get("TETHYS_DB_PORT", 5432)
    return f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = get_db_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    try:
        # Create SQLAlchemy engine
        engine = create_engine(get_db_url())

        # Try to connect
        with engine.connect():
            print("✅ Successfully connected to the database.")
    except OperationalError as e:
        print("❌ Failed to connect to the database.")
        print(e)
        print(
            "Check DB connection parameters. To override connection parameters set the POSTGRES_PASSWORD, TETHYS_DB_HOST, TETHYSDASH_DB_NAME, and/or TETHYS_DB_PORT as needed"  # noqa: E501
        )
        return

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


config.set_main_option("sqlalchemy.url", get_db_url())
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
