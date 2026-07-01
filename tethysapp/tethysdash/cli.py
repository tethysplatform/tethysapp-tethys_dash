import subprocess
import argparse
import re


def setup_command(args):
    print("Configuring Tethys portal...")
    subprocess.run(["tethys", "gen", "portal_config"], check=True)
    print("Updating Tethys Database...")
    subprocess.run(["tethys", "db", "configure"], check=True)
    print("Configuring TethysDash Persistent Store...")
    print("---> Getting TethysDash app workspace path...")
    result = subprocess.run(
        ["tethys", "paths", "get", "-t", "app_workspace", "-a", "tethysdash"],
        capture_output=True,
        text=True,
        check=True,
    )
    # Extract the last non-empty line (the path)
    lines = result.stdout.strip().splitlines()
    app_workspace_path = re.sub(r"\x1b\[[0-9;]*m", "", lines[-1])
    print("---> Creating an SQLite Persistent Store at:", app_workspace_path)
    subprocess.run(
        [
            "tethys",
            "services",
            "create",
            "persistent",
            "-n",
            "tethysdash_sqlite",
            "-t",
            "sqlite",
            "-d",
            app_workspace_path,
        ],
        check=True,
    )
    print("---> Linking Persistent Store to TethysDash app...")
    subprocess.run(
        [
            "tethys",
            "link",
            "persistent:tethysdash_sqlite",
            "tethysdash:ps_database:primary_db",
        ],
        check=True,
    )
    print("Setting up TethysDash Database...")
    subprocess.run(["tethys", "syncstores", "tethysdash"], check=True)
    print("Setup complete.")


def start_command(args):
    print("Starting Tethys Portal")
    subprocess.run(["tethys", "manage", "start"], check=True)


def _resolve_dashboard_id(raw: str) -> int:
    """Accept either an integer ID or a UUID string; return the integer ID.

    Users see dashboard UUIDs in the browser URL (the chat banner prints
    one too) so the CLI should accept that shape directly. Internally
    Dashboard.id is an integer PK (model.py:64), so a UUID has to be
    resolved through the Dashboard.uuid column.

    Lazy-imports the SQLAlchemy session - module-load time predates
    django.setup() in some entry points.
    """
    import sys
    import uuid as _uuid

    # Integer-first: cheapest path, no DB hit needed.
    try:
        return int(raw)
    except (TypeError, ValueError):
        pass

    # UUID shape check before hitting the DB.
    try:
        _uuid.UUID(raw)
    except (TypeError, ValueError, AttributeError):
        sys.exit(
            f"--dashboard must be an integer id or a UUID string, "
            f"got {raw!r}."
        )

    from tethysapp.tethysdash.app import App
    from tethysapp.tethysdash.model import Dashboard

    Session = App.get_persistent_store_database(
        "primary_db", as_sessionmaker=True
    )
    session = Session()
    try:
        row = session.query(Dashboard).filter(Dashboard.uuid == raw).first()
        if row is None:
            sys.exit(
                f"No dashboard found with UUID {raw!r}. Check the URL "
                "or list dashboards in the browser."
            )
        return row.id
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(description="TethysDash CLI")
    subparsers = parser.add_subparsers(title="Commands", dest="subcommand")
    subparsers.required = True

    # Setup command
    setup_parser = subparsers.add_parser(
        "setup", help="Run Tethys portal and DB setup commands"
    )
    setup_parser.set_defaults(func=setup_command)

    # Start command
    start_parser = subparsers.add_parser(
        "start", help="Start the TethysDash application"
    )
    start_parser.set_defaults(func=start_command)

    # Chat command (terminal REPL for the workshop chat agent)
    chat_parser = subparsers.add_parser(
        "chat",
        help="Terminal REPL for the workshop chat agent.",
    )
    chat_parser.add_argument(
        "--user", required=True, help="Django username to act as."
    )
 

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()  # pragma: no cover
