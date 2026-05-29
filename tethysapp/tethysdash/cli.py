import subprocess
import argparse
import re
import sys


def inspect_editable_paths_command(args):
    """Print the resolved LLM-editable-path whitelist for installed Intake plugins.

    With no ``source`` argument: one row per registered Intake plugin, each
    with its resolved path list. With a source argument: detailed view for
    that source, including which args are author-denied.

    Output is text by default. Arg *values* are never printed — only arg
    *names* and deny-list annotations — because plugin args may carry
    sensitive default values (URLs, credentials) that should stay in logs
    and config, not on stdout.

    Exit codes: 0 when the requested source resolves (or listing succeeds),
    1 when a specific source is requested but not found in the Intake
    registry.
    """
    from tethysapp.tethysdash.editable_schemas_plugin import (
        resolve_editable_paths,
    )
    try:
        import intake
    except ImportError:
        intake = None

    if args.source:
        exit_code = _inspect_single_source(
            args.source,
            intake,
            resolve_editable_paths,
        )
        sys.exit(exit_code)

    _inspect_all_sources(
        intake,
        resolve_editable_paths,
    )


def _inspect_single_source(source, intake_module, resolver):
    """Detailed single-source inspection. Returns a shell exit code."""
    # Locate the source in the Intake registry.
    intake_plugin = None
    if intake_module is not None:
        try:
            if source in intake_module.source.registry:
                intake_plugin = intake_module.source.registry[source]
        except (KeyError, TypeError):
            pass

    if intake_plugin is None:
        print(f"Source: {source}")
        print("Status: unresolved")
        print("Reason: plugin not found in the Intake registry. Check "
              "installation + registration.")
        return 1

    print(f"Source: {source}")
    print("Kind: Intake plugin")

    # Resolve the effective editable paths.
    paths = resolver(source)

    # Enumerate registered args for the annotation, from the plugin class's
    # `args` attribute.
    registered_args = _get_registered_args(intake_plugin)

    # Classify each registered arg so the author sees what's denied.
    # Every denial is author-declared (llm_editable_args / llm_non_editable_args).
    allowed_names = {p.replace("/args/", "", 1) for p in paths}
    print("Registered args:")
    if not registered_args:
        print("  (none)")
    else:
        for name in sorted(registered_args):
            marker = "[editable]" if name in allowed_names else "[denied: author]"
            print(f"  {marker} {name}")

    print("Resolved editable paths:")
    if not paths:
        print("  (none)")
        status = "resolved-empty"
        reason = (
            "author declared an empty llm_editable_args allow-list, or "
            "llm_non_editable_args excluded every registered arg."
        )
    else:
        for p in paths:
            print(f"  {p}")
        status = "resolved"
        reason = None

    print(f"Status: {status}")
    if reason:
        print(f"Reason: {reason}")
    return 0


def _inspect_all_sources(intake_module, resolver):
    """No-source listing: every registered Intake plugin, compact."""
    print("Registered plugin sources:")
    if intake_module is None:
        print("  (intake module not importable)")
        return
    try:
        sources = sorted(intake_module.source.registry)
    except TypeError:
        print("  (intake registry is not iterable)")
        return
    if not sources:
        print("  (no plugins registered)")
        return
    for source in sources:
        paths = resolver(source)
        status = "empty" if not paths else f"{len(paths)} path(s)"
        print(f"  Intake  {source:<40} {status}")


def _get_registered_args(intake_plugin):
    """Return a list of registered arg names for annotation.

    Uses get_plugin_prop so plugins declaring ``visualization_args``
    (the legacy naming used throughout ciroh_plugins / nwmp_plugins)
    surface their args in the CLI output. The resolver already uses
    get_plugin_prop; the CLI must match so its annotations stay
    consistent with what the resolver produced.
    """
    from tethysapp.tethysdash.plugin_helpers import get_plugin_prop

    args = get_plugin_prop(intake_plugin, "args", {}) or {}
    if isinstance(args, dict):
        return list(args.keys())
    return []


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

    # inspect_editable_paths command — author-facing inspection of the
    # LLM-editable-path whitelist resolved for each installed plugin.
    inspect_parser = subparsers.add_parser(
        "inspect_editable_paths",
        help="Inspect the LLM-editable-path whitelist for installed plugins",
    )
    inspect_parser.add_argument(
        "source",
        nargs="?",
        default=None,
        help=(
            "Optional source name. When omitted, list every registered plugin "
            "with a summary count of its resolved editable paths."
        ),
    )
    inspect_parser.set_defaults(func=inspect_editable_paths_command)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()  # pragma: no cover
