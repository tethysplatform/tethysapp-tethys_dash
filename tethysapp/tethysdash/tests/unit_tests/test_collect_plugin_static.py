import types
import subprocess
import importlib
from pathlib import Path
from unittest import mock
import pytest

import tethysapp.tethysdash.collect_plugin_static
from tethysapp.tethysdash.collect_plugin_static import (
    get_intake_plugin_modules,
    copy_plugin_static,
    main,
)


@pytest.fixture
def fake_entry_points():
    mock_plugin_a = mock.Mock(module="plugin_a.module")
    mock_plugin_a.name = "plugin_a"
    mock_plugin_b = mock.Mock(module="plugin_b.module")
    mock_plugin_b.name = "plugin_b"

    fake_eps = [mock_plugin_a, mock_plugin_b]
    eps_mock = mock.Mock()
    eps_mock.select.return_value = fake_eps
    return eps_mock


def test_get_intake_plugin_modules(monkeypatch, fake_entry_points):
    monkeypatch.setattr(
        "tethysapp.tethysdash.collect_plugin_static.entry_points",
        lambda: fake_entry_points,
    )
    result = get_intake_plugin_modules()
    assert result == {
        "plugin_a": "plugin_a.module",
        "plugin_b": "plugin_b.module",
    }


@mock.patch("tethysapp.tethysdash.collect_plugin_static.shutil.copy2")
@mock.patch("tethysapp.tethysdash.collect_plugin_static.shutil.copyfile")
def test_copy_plugin_static_image_found(
    copyfile_mock, copy2_mock, monkeypatch, tmp_path
):
    plugin_modules = {"plugin_a": "plugin_a.module"}

    plugin_dir = tmp_path / "plugin_a"
    module_file = plugin_dir / "module.py"
    static_dir = plugin_dir / "static"
    static_dir.mkdir(parents=True)
    image_file = static_dir / "plugin_a.png"
    image_file.write_text("fake image")

    # Add a data file
    data_file = static_dir / "plugin_a.geojson"
    data_file.write_text("geojson data")

    mod_mock = types.SimpleNamespace(__file__=str(module_file))
    monkeypatch.setattr(importlib, "import_module", lambda name: mod_mock)

    # Patch Path.exists
    monkeypatch.setattr(Path, "exists", lambda self: str(self) == str(image_file))

    # Patch os.listdir to include the data file
    monkeypatch.setattr("os.listdir", lambda path: ["plugin_a.geojson"])

    copy_plugin_static(
        plugin_modules, str(tmp_path / "static_out"), str(tmp_path / "data_out")
    )

    copyfile_mock.assert_called_once_with(image_file, mock.ANY)
    copy2_mock.assert_called_once_with(
        str(data_file), str(tmp_path / "data_out" / "plugin_a.geojson")
    )


@mock.patch("tethysapp.tethysdash.collect_plugin_static.shutil.copy2")
@mock.patch("tethysapp.tethysdash.collect_plugin_static.shutil.copyfile")
def test_copy_plugin_static_default_used(
    copyfile_mock, copy2_mock, monkeypatch, tmp_path
):
    plugin_modules = {"plugin_x": "plugin_x.module"}

    module_file = tmp_path / "plugin_x" / "module.py"
    module_file.parent.mkdir(parents=True)
    mod_mock = types.SimpleNamespace(__file__=str(module_file))
    monkeypatch.setattr(importlib, "import_module", lambda name: mod_mock)

    monkeypatch.setattr(Path, "exists", lambda self: False)

    fake_registry = {"plugin_x": mock.Mock(type="map")}
    monkeypatch.setattr(
        "tethysapp.tethysdash.collect_plugin_static.intake.source.registry",
        fake_registry,
    )

    monkeypatch.setattr("os.listdir", lambda path: [])

    copy_plugin_static(plugin_modules, tmp_path / "static_out", tmp_path / "data_out")

    copyfile_mock.assert_called_once_with("default_map.png", mock.ANY)
    copy2_mock.assert_not_called()


@mock.patch("tethysapp.tethysdash.collect_plugin_static.shutil.copyfile")
def test_copy_plugin_static_plugin_skipped(copy_mock, monkeypatch):
    plugin_modules = {"bad_plugin": "bad.module"}

    monkeypatch.setattr(
        importlib,
        "import_module",
        lambda name: (_ for _ in ()).throw(ModuleNotFoundError()),
    )

    copy_plugin_static(plugin_modules, "/tmp/static_out", "/tmp/data_out")
    copy_mock.assert_not_called()


@mock.patch("tethysapp.tethysdash.collect_plugin_static.shutil.copyfile")
def test_copy_plugin_static_attribute_error(copy_mock, monkeypatch, capfd):
    plugin_modules = {"plugin_bad": "plugin_bad.module"}

    # Mock importlib.import_module to return a fake module with a valid __file__
    mod_mock = types.SimpleNamespace(__file__="/fake/path/plugin_bad/module.py")
    monkeypatch.setattr(importlib, "import_module", lambda name: mod_mock)

    # Simulate no images found
    monkeypatch.setattr(Path, "exists", lambda self: False)

    # Setup intake.source.registry to raise AttributeError on visualization_type access
    class DummyPlugin:
        @property
        def visualization_type(self):
            raise AttributeError("No visualization_type attribute")

    fake_registry = {"plugin_bad": DummyPlugin()}
    monkeypatch.setattr(
        "tethysapp.tethysdash.collect_plugin_static.intake.source.registry",
        fake_registry,
    )

    # Run copy_plugin_static
    copy_plugin_static(plugin_modules, "/tmp/static_out", "/tmp/data_out")

    # Assert shutil.copyfile was never called
    copy_mock.assert_not_called()

    # Capture printed output and check for the expected message
    out, err = capfd.readouterr()
    assert "--> plugin_bad is not a tethysdash plugin" in out


@mock.patch("tethysapp.tethysdash.collect_plugin_static.shutil.copyfile")
def test_copy_plugin_static_with_visualization_types(
    copyfile_mock, monkeypatch, tmp_path
):
    plugin_modules = {"plugin_x": "plugin_x.module"}

    module_file = tmp_path / "plugin_x" / "module.py"
    module_file.parent.mkdir(parents=True)
    module_file.touch()

    mod_mock = types.SimpleNamespace(__file__=str(module_file))
    monkeypatch.setattr(importlib, "import_module", lambda name: mod_mock)

    # Patch Path.exists to always return False (simulate no image files found)
    monkeypatch.setattr(Path, "exists", lambda self: False)

    # Simulate static dir path for os.listdir to avoid FileNotFoundError
    monkeypatch.setattr("os.listdir", lambda path: [])

    # Replace visualization type logic
    visualization_types_and_images = {
        "image": "default_image.png",
        "text": "default_text.png",
        "variableInput": "default_variable_input.png",
        "map": "default_map.png",
        "plotly": "default_chart.png",
        "card": "default_card.png",
        "table": "default_table.png",
        "custom": "default_custom.png",
        "live_chat": "default_live_chat.png",
    }

    for vis_type, expected_image in visualization_types_and_images.items():
        fake_registry = {"plugin_x": mock.Mock(type=vis_type)}
        monkeypatch.setattr(
            "tethysapp.tethysdash.collect_plugin_static.intake.source.registry",
            fake_registry,
        )

        copyfile_mock.reset_mock()

        copy_plugin_static(
            plugin_modules, str(tmp_path / "static_out"), str(tmp_path / "data_out")
        )

        copyfile_mock.assert_called_once_with(expected_image, mock.ANY)


@pytest.mark.parametrize("bad_type", ["unknown", None, ""])
@mock.patch("builtins.print")
@mock.patch("tethysapp.tethysdash.collect_plugin_static.shutil.copyfile")
def test_copy_plugin_static_unknown_type(copy_mock, print_mock, monkeypatch, bad_type):
    plugin_modules = {"plugin_x": "plugin_x.module"}

    module_file = Path("/fake/path/plugin_x/module.py")
    mod_mock = types.SimpleNamespace(__file__=str(module_file))
    monkeypatch.setattr(importlib, "import_module", lambda name: mod_mock)
    monkeypatch.setattr(Path, "exists", lambda self: False)  # No files exist

    fake_registry = {"plugin_x": mock.Mock(visualization_type=bad_type)}
    monkeypatch.setattr(
        "tethysapp.tethysdash.collect_plugin_static.intake.source.registry",
        fake_registry,
    )

    copy_plugin_static(plugin_modules, "/tmp/static_out", "/tmp/data_out")

    copy_mock.assert_not_called()
    print_mock.assert_called_once_with("--> PNG thumbnail not available for plugin_x")


def test_main_collectstatic_failure(monkeypatch, capfd):
    # Skip os.path.exists side-effects
    monkeypatch.setattr("os.path.exists", lambda path: True)

    # Stub internal plugin logic
    monkeypatch.setattr(
        tethysapp.tethysdash.collect_plugin_static,
        "get_intake_plugin_modules",
        lambda: {},
    )
    monkeypatch.setattr(
        tethysapp.tethysdash.collect_plugin_static,
        "copy_plugin_static",
        lambda plugins, path, data_path=None: None,
    )

    # Simulate subprocess failure
    fake_result = subprocess.CompletedProcess(
        args=["tethys", "manage", "collectstatic", "tethysdash", "--noinput"],
        returncode=1,
        stdout="",
        stderr="Simulated error\n",
    )
    monkeypatch.setattr("subprocess.run", lambda *args, **kwargs: fake_result)

    # Run main and capture output
    tethysapp.tethysdash.collect_plugin_static.main()
    out, err = capfd.readouterr()

    assert "Command failed with error:" in out
    assert "Simulated error" in out


def test_main(monkeypatch, tmp_path):
    monkeypatch.setattr(
        "tethysapp.tethysdash.collect_plugin_static.get_intake_plugin_modules",
        lambda: {},
    )
    monkeypatch.setattr(
        "tethysapp.tethysdash.collect_plugin_static.copy_plugin_static",
        lambda x, y, z: None,
    )
    monkeypatch.setattr("os.path.exists", lambda path: False)
    monkeypatch.setattr("os.makedirs", lambda path: None)

    fake_result = subprocess.CompletedProcess(
        args=[], returncode=0, stdout="Success", stderr=""
    )
    monkeypatch.setattr("subprocess.run", lambda *args, **kwargs: fake_result)

    main()
