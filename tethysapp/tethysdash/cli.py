import subprocess
import argparse


def setup_command(args):
    print("Running: tethys gen portal_config")
    subprocess.run(["tethys", "gen", "portal_config"], check=True)
    print("Running: tethys db configure")
    subprocess.run(["tethys", "db", "configure"], check=True)
    print("Setup complete.")


def main():
    parser = argparse.ArgumentParser(description="TethysDash CLI")
    subparsers = parser.add_subparsers(title="Commands", dest="subcommand")
    subparsers.required = True

    # Setup command
    setup_parser = subparsers.add_parser(
        "setup", help="Run Tethys portal and DB setup commands"
    )
    setup_parser.set_defaults(func=setup_command)

    # Add more subcommands here as needed

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
