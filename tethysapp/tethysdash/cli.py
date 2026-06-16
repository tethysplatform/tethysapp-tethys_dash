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


def chat_command(args):
    """Terminal REPL harness for chat agents.

    This is a domain-blind harness: it knows about Django, the active
    user/dashboard, readline + history persistence, and the AgentRunner
    protocol - and nothing else. Plugins (named by the operator in
    ``settings.AGENTS.PACKAGES``) own the agent shape, backstories,
    tools, and topology.

    All Django / tethys_agents imports happen here (not at module top) so
    that `tethysdash setup` and `tethysdash start` stay fast and don't
    pull the full app registry.
    """
    import os
    import sys
    # readline upgrades input() with arrow-key line editing, up/down
    # history navigation, and Ctrl+R reverse search. Just importing it
    # is enough - no further calls needed for in-session editing.
    import readline
    from pathlib import Path

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tethys_portal.settings")
    import django
    django.setup()

    from django.conf import settings
    from django.contrib.auth import get_user_model
    from tethys_agents.runner import discover_runners
    from tethysapp.tethysdash.controllers import DEFAULT_AGENT_MODEL
    from tethysapp.tethysdash.tools import current_dashboard
    from tethysapp.tethysdash.model import get_dashboards

    # Unified AGENTS block from portal_config.yaml:
    #     settings:
    #       AGENTS:
    #         PACKAGES: [...]      # tools + runners - discovery layers
    #                              # each pick the submodule they need.
    #         MODELS:              # list of {name, host} dicts. First entry
    #                              # is the default; CLI --model picks any
    #                              # other entry by name (or any free-form
    #                              # name, in which case the default host
    #                              # applies). Per-model host lets future
    #                              # entries point at different backends.
    #           - name: <model>
    #             host: <url>
    #         MODE:    <name>      # default runner name (CLI --runner wins).
    agents_cfg = getattr(settings, "AGENTS", None)
    if not isinstance(agents_cfg, dict):
        agents_cfg = {}

    # Resolution order: CLI --model > AGENTS.MODELS[0].name > DEFAULT_AGENT_MODEL.
    # Resolved AFTER django.setup() because settings aren't readable at
    # argparse-build time.
    models_list = [m for m in (agents_cfg.get("MODELS") or []) if isinstance(m, dict)]
    default_entry = models_list[0] if models_list else {}
    default_name = default_entry.get("name") or DEFAULT_AGENT_MODEL
    model = args.model or default_name
    # Find the chosen model's entry to pick up its host. If --model named
    # a model not listed in MODELS, fall back to the default entry's host
    # (workshop assumption: one ollama backend hosts every model name you
    # might pull at runtime).
    chosen_entry = next(
        (m for m in models_list if m.get("name") == model),
        default_entry,
    )
    host = chosen_entry.get("host")
    if host:
        # The tethys_agents._ollama wrapper reads OLLAMA_HOST from
        # os.environ at construction time; setting it here is the seam.
        os.environ["OLLAMA_HOST"] = str(host)

    User = get_user_model()
    try:
        user = User.objects.get(username=args.user)
    except User.DoesNotExist:
        sys.exit(
            f"User {args.user!r} not found. Create one via "
            "`tethys manage createsuperuser`."
        )

    if args.dashboard is not None:
        # --dashboard accepts EITHER the integer PK (e.g. 2) OR the
        # UUID string visible in the browser URL (e.g. 5976be43-...).
        # Dashboard.id (model.py:64) is an Integer column, so a UUID
        # lookup needs to resolve through Dashboard.uuid first.
        dashboard_id = _resolve_dashboard_id(args.dashboard)
    else:
        owned = get_dashboards(user)
        if not owned:
            sys.exit(
                f"User {user.username!r} owns no dashboards. Create one in "
                "the browser first, or pass --dashboard <id-or-uuid>."
            )
        dashboard_id = max(owned, key=lambda d: d.get("id", 0))["id"]

    dashboard = get_dashboards(user, id=dashboard_id, dashboard_view=True)
    if dashboard is None or not isinstance(dashboard, dict):
        # get_dashboards crashes with AttributeError inside
        # parse_db_dashboard if the row was deleted between resolution
        # and read. Catch the resolved-but-missing case explicitly here
        # so the user sees "not found" instead of a Python traceback.
        sys.exit(
            f"Dashboard id={dashboard_id!r} could not be loaded "
            f"(may have been deleted, or {user.username!r} lacks access)."
        )
    uuid = dashboard.get("uuid", "?")

    # Set the contextvar ONCE for the whole REPL session. Runners use it
    # transitively when their tools mutate the active dashboard.
    current_dashboard.set({"user": user, "dashboard_id": dashboard_id})

    # Unified package list. Each discovery layer picks the submodule it
    # needs: discover_runners walks <pkg>.agent for RUNNERS dicts;
    # discover (called by the runner) walks <pkg>.tools for @tool
    # functions. Missing submodules are skipped silently - so a
    # tools-only package and a runners-only package can live in the same
    # PACKAGES list with no operator intervention.
    packages = [str(p).strip() for p in (agents_cfg.get("PACKAGES") or []) if str(p).strip()]
    # The harness always needs its own mutation tools available to runners,
    # even if the operator forgot to list it explicitly.
    if "tethysapp.tethysdash" not in packages:
        packages.append("tethysapp.tethysdash")
    if not packages:
        sys.exit(
            "AGENTS.PACKAGES is empty. Add at least one chat-agent plugin "
            "to portal_config.yaml, e.g.:\n"
            "    settings:\n"
            "      AGENTS:\n"
            "        PACKAGES:\n"
            "          - <your_workshop_plugin>"
        )
    try:
        runners = discover_runners(packages)
    except ModuleNotFoundError as exc:
        sys.exit(
            f"Could not import {exc.name!r}.\n\n"
            "AGENTS.PACKAGES expects importable Python packages. Each may "
            "contribute tools (<pkg>.tools), runners (<pkg>.agent), or both. "
            "Common causes:\n"
            "  - Typo in the package name.\n"
            "  - Package not installed in this environment.\n\n"
            f"Current AGENTS.PACKAGES (incl. harness defaults): {packages}"
        )
    if not runners:
        sys.exit(
            f"No runners exposed by {packages}. At least one package must "
            "define a RUNNERS dict at <pkg>.agent."
        )
    runner_name = args.runner or agents_cfg.get("MODE") or next(iter(runners))
    if runner_name not in runners:
        sys.exit(
            f"Runner {runner_name!r} not found. Available runners "
            f"(from {packages}): {sorted(runners)}"
        )
    runner = runners[runner_name](
        model=model,
        dashboard_tool_packages=packages,
    )

    # Banner.
    print(f"Active dashboard: id={dashboard_id} uuid={uuid}")
    print(f"View at: http://localhost:8000/apps/tethysdash/dashboard/{uuid}/")
    print(f"Model:    {model}")
    print(f"Packages: {packages}")
    print(f"Runner:   {runner_name} - {runner.describe()}")
    print(f"Available runners: {sorted(runners)}")
    print("Type /exit to quit, /clear to reset runner state.\n")

    # Persist prompt history across REPL sessions. Missing file on first
    # run is fine - read_history_file errors are non-fatal.
    history_file = Path.home() / ".cache" / "tethysdash" / "chat_history"
    history_file.parent.mkdir(parents=True, exist_ok=True)
    try:
        readline.read_history_file(history_file)
    except FileNotFoundError:
        pass
    readline.set_history_length(1000)

    try:
        _repl_loop(runner)
    finally:
        try:
            readline.write_history_file(history_file)
        except OSError as exc:
            print(f"[warn] could not write history file: {exc}")


def _repl_loop(runner) -> None:
    """Generic REPL: takes any AgentRunner, knows nothing about agent shape.

    The runner's ``run_turn`` does its own printing; the harness just
    handles input, /exit, /clear, and the refresh nudge.
    """
    while True:
        try:
            msg = input("\n› ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not msg:
            continue
        if msg in {"/exit", "/quit"}:
            break
        if msg == "/clear":
            runner.reset()
            print("Runner state cleared.")
            continue

        try:
            runner.run_turn(msg)
        except Exception as exc:  # noqa: BLE001 - workshop UX, show everything
            print(f"\n[runner error] {exc}")
            continue
        print("(refresh the dashboard tab to see changes)")


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
    chat_parser.add_argument(
        "--dashboard",
        type=str,
        help=(
            "Dashboard to target. Accepts either the integer PK "
            "(e.g. '2') or the UUID string from the browser URL "
            "(e.g. '5976be43-3f09-4f62-aa08-920974cab70a'). "
            "Default: most recent dashboard owned by --user."
        ),
    )
    chat_parser.add_argument(
        "--model",
        default=None,
        help=(
            "LLM model name. Default: first entry of portal_config "
            "AGENTS.MODELS, falling back to DEFAULT_AGENT_MODEL from "
            "controllers.py. Pass this flag to override per-invocation."
        ),
    )
    chat_parser.add_argument(
        "--runner",
        default=None,
        help=(
            "Runner name exposed by one of the packages in AGENTS.PACKAGES. "
            "Default: portal_config AGENTS.MODE, falling back to the first "
            "runner discovered. Use any value to see the 'available "
            "runners' list in the error message."
        ),
    )
    chat_parser.set_defaults(func=chat_command)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()  # pragma: no cover
