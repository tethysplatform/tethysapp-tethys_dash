import subprocess
import argparse
import re
import sys


def inspect_editable_paths_command(args):
    """Print the resolved LLM-editable-path whitelist for installed plugins.

    With no ``source`` argument: one row per registered plugin (Intake +
    client_custom), each with its resolved path list. With a source
    argument: detailed view for that source, including which args were
    caught by the R10 sensitive-name pattern deny-list.

    Output is text by default. Arg *values* are never printed — only arg
    *names* and deny-list annotations — because plugin args may carry
    sensitive default values (URLs, credentials) that should stay in logs
    and config, not on stdout.

    Exit codes: 0 when the requested source resolves (or listing succeeds),
    1 when a specific source is requested but not found in any registry.
    """
    from tethysapp.tethysdash.editable_schemas_plugin import (
        resolve_editable_paths,
    )
    from tethysapp.tethysdash.plugin_registry_loader import (
        load_client_plugin_registry,
    )
    try:
        import intake
    except ImportError:
        intake = None

    if args.source:
        exit_code = _inspect_single_source(
            args.source,
            intake,
            load_client_plugin_registry,
            resolve_editable_paths,
        )
        sys.exit(exit_code)

    _inspect_all_sources(
        intake,
        load_client_plugin_registry,
        resolve_editable_paths,
    )


def _inspect_single_source(
    source,
    intake_module,
    client_registry_loader,
    resolver,
):
    """Detailed single-source inspection. Returns a shell exit code."""
    # Locate the source in either registry.
    intake_plugin = None
    if intake_module is not None:
        try:
            if source in intake_module.source.registry:
                intake_plugin = intake_module.source.registry[source]
        except (KeyError, TypeError):
            pass
    client_entry = next(
        (e for e in client_registry_loader() if e.get("source") == source),
        None,
    )

    if intake_plugin is None and client_entry is None:
        print(f"Source: {source}")
        print("Status: unresolved")
        print("Reason: plugin not found in the Intake registry or the "
              "client plugin registry. Check installation + registration.")
        return 1

    kind = "Intake plugin" if intake_plugin is not None else "client_custom plugin"
    print(f"Source: {source}")
    print(f"Kind: {kind}")

    # Resolve the effective editable paths.
    paths = resolver(source)

    # Enumerate registered args for the annotation. For Intake, this comes
    # from the plugin class's `args` attribute; for client_custom, from
    # the registry entry's `args` dict.
    registered_args = _get_registered_args(intake_plugin, client_entry)

    # Classify each registered arg so the author sees what's denied.
    # With the project-wide pattern deny-list removed, every denial is
    # author-declared (llm_editable_args / llm_non_editable_args).
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


def _inspect_all_sources(intake_module, client_registry_loader, resolver):
    """No-source listing: every Intake + client_custom plugin, compact."""
    print("Registered plugin sources:")
    seen = []
    if intake_module is not None:
        try:
            for source in sorted(intake_module.source.registry):
                paths = resolver(source)
                status = "empty" if not paths else f"{len(paths)} path(s)"
                print(f"  Intake         {source:<40} {status}")
                seen.append(source)
        except TypeError:
            pass
    for entry in client_registry_loader():
        source = entry.get("source", "<unknown>")
        if source in seen:
            continue
        paths = resolver(source)
        status = "empty" if not paths else f"{len(paths)} path(s)"
        print(f"  client_custom  {source:<40} {status}")


def _get_registered_args(intake_plugin, client_entry):
    """Return a list of registered arg names for annotation.

    Uses get_plugin_prop for Intake plugins so plugins declaring
    `visualization_args` (the legacy naming used throughout ciroh_plugins
    / nwmp_plugins) surface their args in the CLI output. The resolver
    already uses get_plugin_prop; the CLI must match so its annotations
    stay consistent with what the resolver produced.
    """
    from tethysapp.tethysdash.plugin_helpers import get_plugin_prop

    if intake_plugin is not None:
        args = get_plugin_prop(intake_plugin, "args", {}) or {}
        if isinstance(args, dict):
            return list(args.keys())
    if client_entry is not None:
        args = client_entry.get("args") or {}
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
    main()
