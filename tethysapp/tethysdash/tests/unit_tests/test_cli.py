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


class TestInspectEditablePathsCommand(unittest.TestCase):
    """Unit tests for the inspect_editable_paths subcommand (R13)."""

    def _invoke(self, source, capsys=None, **patches):
        """Run the command via subprocess to avoid logger pollution."""
        import argparse as _argparse
        from io import StringIO
        from contextlib import redirect_stdout

        cli = importlib.import_module("tethysapp.tethysdash.cli")
        buf = StringIO()
        args = _argparse.Namespace(source=source)
        exit_code = 0
        try:
            with redirect_stdout(buf):
                cli.inspect_editable_paths_command(args)
        except SystemExit as e:
            exit_code = e.code if isinstance(e.code, int) else 1
        return exit_code, buf.getvalue()

    @mock.patch(
        "tethysapp.tethysdash.plugin_registry_loader.load_client_plugin_registry"
    )
    def test_unknown_source_exits_nonzero(self, mock_registry_loader):
        """When a specific source isn't in any registry, exit code is 1."""
        import tethysapp.tethysdash.editable_schemas_plugin as esp

        mock_registry_loader.return_value = []
        with mock.patch.object(esp.intake.source, "registry", {}):
            exit_code, out = self._invoke(source="phantom_plugin")
        self.assertEqual(exit_code, 1)
        self.assertIn("phantom_plugin", out)
        self.assertIn("unresolved", out.lower())

    @mock.patch(
        "tethysapp.tethysdash.plugin_registry_loader.load_client_plugin_registry"
    )
    def test_known_intake_plugin_shows_editable_paths(self, mock_registry_loader):
        from types import SimpleNamespace
        import tethysapp.tethysdash.editable_schemas_plugin as esp

        mock_registry_loader.return_value = []
        # Author declares an explicit deny-list entry so we get a mix of
        # [editable] and [denied: author] in the output.
        fake_plugin = SimpleNamespace(
            args={"start_date": "text", "api_key": "text"},
            llm_non_editable_args=["api_key"],
        )
        with mock.patch.object(
            esp.intake.source, "registry", {"my_streamflow": fake_plugin}
        ):
            exit_code, out = self._invoke(source="my_streamflow")
        self.assertEqual(exit_code, 0)
        self.assertIn("my_streamflow", out)
        self.assertIn("Intake plugin", out)
        # start_date is editable; api_key is author-denied.
        self.assertIn("[editable] start_date", out)
        self.assertIn("[denied: author] api_key", out)
        self.assertIn("/args/start_date", out)
        # Sensitive arg value must NEVER appear — the annotation lists only
        # the name. (This test exercises only arg names, but pins the rule.)
        self.assertNotIn("some_secret_value", out)

    @mock.patch(
        "tethysapp.tethysdash.plugin_registry_loader.load_client_plugin_registry"
    )
    def test_client_custom_source_shows_registry_entry(self, mock_registry_loader):
        import tethysapp.tethysdash.editable_schemas_plugin as esp

        mock_registry_loader.return_value = [
            {
                "source": "nwm-flood-map",
                "args": {"title": "text", "dataUrl": "text", "authToken": "text"},
                "llmNonEditableArgs": ["authToken"],
            }
        ]
        # editable_schemas_plugin caches via its own indirection;
        # patch that symbol so the resolver sees the test registry.
        with mock.patch.object(esp.intake.source, "registry", {}), \
             mock.patch.object(
                 esp,
                 "_load_client_plugin_registry_cached",
                 return_value=[
                     {
                         "source": "nwm-flood-map",
                         "args": {
                             "title": "text",
                             "dataUrl": "text",
                             "authToken": "text",
                         },
                         "llmNonEditableArgs": ["authToken"],
                     }
                 ],
             ):
            exit_code, out = self._invoke(source="nwm-flood-map")
        self.assertEqual(exit_code, 0)
        self.assertIn("client_custom plugin", out)
        self.assertIn("[editable] title", out)
        self.assertIn("[editable] dataUrl", out)
        self.assertIn("[denied: author] authToken", out)

    @mock.patch(
        "tethysapp.tethysdash.plugin_registry_loader.load_client_plugin_registry"
    )
    def test_intake_plugin_with_legacy_visualization_args_naming(
        self, mock_registry_loader
    ):
        """Regression: ciroh_plugins use `visualization_args` (legacy naming).

        The CLI must honor the same get_plugin_prop lookup the resolver uses
        so authors see their declared args annotated in the inspect output.
        Raw getattr(plugin, "args") would miss these — the class has
        `visualization_args` set and no bare `args` attribute.
        """
        from types import SimpleNamespace
        import tethysapp.tethysdash.editable_schemas_plugin as esp

        mock_registry_loader.return_value = []
        # Plugin declares args via the legacy visualization_* naming.
        # No bare `args` attribute — this is how ciroh_plugins work.
        # Author denies one arg explicitly to exercise the [denied: author]
        # annotation alongside [editable].
        fake_plugin = SimpleNamespace(
            visualization_args={
                "id": "text",
                "api_key": "text",
            },
            llm_non_editable_args=["api_key"],
        )
        with mock.patch.object(
            esp.intake.source, "registry", {"nwmp_api_reaches": fake_plugin}
        ), mock.patch.object(
            esp, "_load_client_plugin_registry_cached", return_value=[]
        ):
            exit_code, out = self._invoke(source="nwmp_api_reaches")
        self.assertEqual(exit_code, 0)
        # Both args surface in the registered-args listing despite using
        # the legacy `visualization_args` attribute name.
        self.assertIn("[editable] id", out)
        self.assertIn("[denied: author] api_key", out)
        # And the resolver emits the right path.
        self.assertIn("/args/id", out)

    @mock.patch(
        "tethysapp.tethysdash.plugin_registry_loader.load_client_plugin_registry"
    )
    def test_no_source_lists_all_plugins(self, mock_registry_loader):
        from types import SimpleNamespace
        import tethysapp.tethysdash.editable_schemas_plugin as esp

        mock_registry_loader.return_value = []
        fake_plugin = SimpleNamespace(args={"station": "text"})
        with mock.patch.object(
            esp.intake.source, "registry", {"my_plugin": fake_plugin}
        ), mock.patch.object(
            esp, "_load_client_plugin_registry_cached", return_value=[]
        ):
            exit_code, out = self._invoke(source=None)
        self.assertEqual(exit_code, 0)
        self.assertIn("my_plugin", out)
        self.assertIn("Intake", out)
