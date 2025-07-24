import types
import subprocess
import importlib
from pathlib import Path
from unittest import mock
import runpy

import pytest

import tethysapp.tethysdash.collect_plugin_thumbnails
from tethysapp.tethysdash.collect_plugin_thumbnails import (
    get_intake_plugin_modules,
    copy_plugin_images,
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
        "tethysapp.tethysdash.collect_plugin_thumbnails.entry_points",
        lambda: fake_entry_points,
    )
    result = get_intake_plugin_modules()
    assert result == {
        "plugin_a": "plugin_a.module",
        "plugin_b": "plugin_b.module",
    }


@mock.patch("tethysapp.tethysdash.collect_plugin_thumbnails.shutil.copyfile")
def test_copy_plugin_images_image_found(copy_mock, monkeypatch, tmp_path):
    plugin_modules = {"plugin_a": "plugin_a.module"}

    # Create the dummy file structure
    plugin_dir = tmp_path / "plugin_a"
    module_file = plugin_dir / "module.py"
    static_dir = plugin_dir / "static"
    static_dir.mkdir(parents=True)
    image_file = static_dir / "plugin_a.png"
    image_file.write_text("fake image")

    # Mock the imported module to simulate real module path
    mod_mock = types.SimpleNamespace(__file__=str(module_file))
    monkeypatch.setattr(importlib, "import_module", lambda name: mod_mock)

    # Patch Path.exists to only return True for the .png
    monkeypatch.setattr(Path, "exists", lambda self: str(self) == str(image_file))

    # Run function
    copy_plugin_images(plugin_modules, str(tmp_path / "static_out"))

    # Assert the image was copied
    copy_mock.assert_called_once_with(image_file, mock.ANY)


@mock.patch("tethysapp.tethysdash.collect_plugin_thumbnails.shutil.copyfile")
def test_copy_plugin_images_default_used(copy_mock, monkeypatch, tmp_path):
    plugin_modules = {"plugin_x": "plugin_x.module"}

    # Create dummy module with __file__ pointing to fake plugin
    module_file = tmp_path / "plugin_x" / "module.py"
    module_file.parent.mkdir(parents=True)
    mod_mock = types.SimpleNamespace(__file__=str(module_file))
    monkeypatch.setattr(importlib, "import_module", lambda name: mod_mock)

    # Simulate no plugin image found (Path.exists always returns False)
    monkeypatch.setattr(Path, "exists", lambda self: False)

    # Mock intake source registry with visualization_type
    fake_registry = {"plugin_x": mock.Mock(visualization_type="map")}
    monkeypatch.setattr(
        "tethysapp.tethysdash.collect_plugin_thumbnails.intake.source.registry",
        fake_registry,
    )

    # Run function
    copy_plugin_images(plugin_modules, tmp_path / "static_out")

    # Assert correct fallback image used
    copy_mock.assert_called_once_with("default_map.png", mock.ANY)


@mock.patch("tethysapp.tethysdash.collect_plugin_thumbnails.shutil.copyfile")
def test_copy_plugin_images_plugin_skipped(copy_mock, monkeypatch):
    plugin_modules = {"bad_plugin": "bad.module"}

    monkeypatch.setattr(
        importlib,
        "import_module",
        lambda name: (_ for _ in ()).throw(ModuleNotFoundError()),
    )

    copy_plugin_images(plugin_modules, "/tmp/static_out")
    copy_mock.assert_not_called()


@mock.patch("tethysapp.tethysdash.collect_plugin_thumbnails.shutil.copyfile")
def test_copy_plugin_images_attribute_error(copy_mock, monkeypatch, capfd):
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
        "tethysapp.tethysdash.collect_plugin_thumbnails.intake.source.registry",
        fake_registry,
    )

    # Run copy_plugin_images
    copy_plugin_images(plugin_modules, "/tmp/static_out")

    # Assert shutil.copyfile was never called
    copy_mock.assert_not_called()

    # Capture printed output and check for the expected message
    out, err = capfd.readouterr()
    assert "--> plugin_bad is not a tethysdash plugin" in out


@mock.patch("tethysapp.tethysdash.collect_plugin_thumbnails.shutil.copyfile")
def test_copy_plugin_images_with_visualization_types(copy_mock, monkeypatch):
    plugin_modules = {"plugin_x": "plugin_x.module"}

    module_file = Path("/fake/path/plugin_x/module.py")
    mod_mock = types.SimpleNamespace(__file__=str(module_file))
    monkeypatch.setattr(importlib, "import_module", lambda name: mod_mock)
    monkeypatch.setattr(Path, "exists", lambda self: False)  # No files exist

    visualization_types_and_images = {
        "image": "default_image.png",
        "text": "default_text.png",
        "variableInput": "default_variable_input.png",
        "map": "default_map.png",
        "plotly": "default_chart.png",
        "card": "default_card.png",
        "table": "default_table.png",
        "custom": "default_custom.png",
    }

    for vis_type, expected_image in visualization_types_and_images.items():
        fake_registry = {"plugin_x": mock.Mock(visualization_type=vis_type)}
        monkeypatch.setattr(
            "tethysapp.tethysdash.collect_plugin_thumbnails.intake.source.registry",
            fake_registry,
        )

        copy_mock.reset_mock()

        copy_plugin_images(plugin_modules, "/tmp/static_out")

        copy_mock.assert_called_once_with(expected_image, mock.ANY)


@pytest.mark.parametrize("bad_type", ["unknown", None, ""])
@mock.patch("builtins.print")
@mock.patch("tethysapp.tethysdash.collect_plugin_thumbnails.shutil.copyfile")
def test_copy_plugin_images_unknown_type(copy_mock, print_mock, monkeypatch, bad_type):
    plugin_modules = {"plugin_x": "plugin_x.module"}

    module_file = Path("/fake/path/plugin_x/module.py")
    mod_mock = types.SimpleNamespace(__file__=str(module_file))
    monkeypatch.setattr(importlib, "import_module", lambda name: mod_mock)
    monkeypatch.setattr(Path, "exists", lambda self: False)  # No files exist

    fake_registry = {"plugin_x": mock.Mock(visualization_type=bad_type)}
    monkeypatch.setattr(
        "tethysapp.tethysdash.collect_plugin_thumbnails.intake.source.registry",
        fake_registry,
    )

    copy_plugin_images(plugin_modules, "/tmp/static_out")

    copy_mock.assert_not_called()
    print_mock.assert_called_once_with("--> PNG thumbnail not available for plugin_x")


def test_main_collectstatic_failure(monkeypatch, capfd):
    # Mock os.path.exists to True to skip folder creation
    monkeypatch.setattr("os.path.exists", lambda path: True)

    # Mock get_intake_plugin_modules and copy_plugin_images to do nothing
    monkeypatch.setattr(
        tethysapp.tethysdash.collect_plugin_thumbnails,
        "get_intake_plugin_modules",
        lambda: {},
    )
    monkeypatch.setattr(
        tethysapp.tethysdash.collect_plugin_thumbnails,
        "copy_plugin_images",
        lambda plugins, path: None,
    )

    # Mock subprocess.run to simulate failure
    fake_result = subprocess.CompletedProcess(
        args=["tethys", "manage", "collectstatic", "tethysdash", "--noinput"],
        returncode=1,
        stdout="",
        stderr="Simulated error",
    )
    monkeypatch.setattr("subprocess.run", lambda *args, **kwargs: fake_result)

    # Run main()
    tethysapp.tethysdash.collect_plugin_thumbnails.main()

    # Capture output
    out, err = capfd.readouterr()

    # Assert failure messages printed
    assert "Command failed with error:" in out
    assert "Simulated error" in out


def test_main(monkeypatch, tmp_path):
    # Setup static folder
    monkeypatch.setattr(
        "tethysapp.tethysdash.collect_plugin_thumbnails.get_intake_plugin_modules",
        lambda: {},
    )
    monkeypatch.setattr(
        "tethysapp.tethysdash.collect_plugin_thumbnails.copy_plugin_images",
        lambda x, y: None,
    )
    monkeypatch.setattr("os.path.exists", lambda path: False)
    monkeypatch.setattr("os.makedirs", lambda path: None)

    fake_result = subprocess.CompletedProcess(
        args=[], returncode=0, stdout="Success", stderr=""
    )
    monkeypatch.setattr("subprocess.run", lambda *args, **kwargs: fake_result)

    # This is mainly to check that it runs without errors
    main()


@mock.patch("tethysapp.tethysdash.collect_plugin_thumbnails.shutil.copyfile")
def test_main_entry_point(copy_mock, monkeypatch):
    copy_mock.side_effect = lambda src, dst: None  # do nothing, avoid file not found

    runpy.run_module(
        "tethysapp.tethysdash.collect_plugin_thumbnails", run_name="__main__"
    )
