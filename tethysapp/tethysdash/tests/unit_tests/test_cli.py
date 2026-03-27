import unittest
from unittest import mock
import argparse
import importlib


class TestCLI(unittest.TestCase):
    @mock.patch("subprocess.run")
    def test_setup_command(self, mock_run):
        # Import cli and call setup_command
        cli = importlib.import_module("tethysapp.tethysdash.cli")
        # Mock the output of the app_workspace_path subprocess
        mock_run.side_effect = [
            mock.Mock(),  # tethys gen portal_config
            mock.Mock(),  # tethys db configure
            mock.Mock(stdout="\x1b[0m/some/path\n"),  # tethys paths get
            mock.Mock(),  # tethys services create persistent
            mock.Mock(),  # tethys link persistent
            mock.Mock(),  # tethys syncstores
        ]
        cli.setup_command(argparse.Namespace())
        # Check that subprocess.run was called with expected commands
        expected_calls = [
            mock.call(["tethys", "gen", "portal_config"], check=True),
            mock.call(["tethys", "db", "configure"], check=True),
            mock.call(
                ["tethys", "paths", "get", "-t", "app_workspace", "-a", "tethysdash"],
                capture_output=True,
                text=True,
                check=True,
            ),
            mock.call(
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
                    "/some/path",
                ],
                check=True,
            ),
            mock.call(
                [
                    "tethys",
                    "link",
                    "persistent:tethysdash_sqlite",
                    "tethysdash:ps_database:primary_db",
                ],
                check=True,
            ),
            mock.call(["tethys", "syncstores", "tethysdash"], check=True),
        ]
        mock_run.assert_has_calls(expected_calls)

    @mock.patch("subprocess.run")
    def test_start_command(self, mock_run):
        cli = importlib.import_module("tethysapp.tethysdash.cli")
        cli.start_command(argparse.Namespace())
        mock_run.assert_called_once_with(["tethys", "manage", "start"], check=True)

    @mock.patch("argparse.ArgumentParser.parse_args")
    @mock.patch("tethysapp.tethysdash.cli.setup_command")
    def test_main_setup(self, mock_setup, mock_parse_args):
        import tethysapp.tethysdash.cli as cli

        args = argparse.Namespace(func=mock_setup)
        mock_parse_args.return_value = args
        cli.main()
        mock_setup.assert_called_once_with(args)

    @mock.patch("argparse.ArgumentParser.parse_args")
    @mock.patch("tethysapp.tethysdash.cli.start_command")
    def test_main_start(self, mock_start, mock_parse_args):
        import tethysapp.tethysdash.cli as cli

        args = argparse.Namespace(func=mock_start)
        mock_parse_args.return_value = args
        cli.main()
        mock_start.assert_called_once_with(args)
