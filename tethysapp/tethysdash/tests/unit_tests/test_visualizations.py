from tethysapp.tethysdash.visualizations import (
    get_available_visualizations,
    get_visualization,
)


def test_get_available_visualizations(mock_plugin, mock_plugin_visualization, mocker):
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_intake.source.registry = [mock_plugin.name]
    mock_intake.open_package_name = mock_plugin

    available_visualizations = get_available_visualizations()

    assert available_visualizations == {"visualizations": [mock_plugin_visualization]}


def test_get_available_visualizations2(
    mock_plugin, mock_plugin2, mock_plugin_visualization2, mocker
):
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_intake.source.registry = [mock_plugin.name, mock_plugin2.name]
    mock_intake.open_package_name = mock_plugin
    mock_intake.open_package_name2 = mock_plugin2
    mock_intake.open_package_name2.visualization_tags = []
    mock_intake.open_package_name2.visualization_description = ""

    available_visualizations = get_available_visualizations()

    assert available_visualizations == {"visualizations": [mock_plugin_visualization2]}


def test_get_visualization(mock_plugin, mocker):
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_intake.open_package_name = mock_plugin
    mock_intake.open_package_name().read.return_value = "some_data"

    test_args = {"some_arg": "test"}
    viz_type, viz_data = get_visualization(mock_plugin.name, test_args)

    mock_intake.open_package_name.assert_called_with(some_arg="test")
    assert viz_type == mock_plugin.visualization_type
    assert viz_data == "some_data"
