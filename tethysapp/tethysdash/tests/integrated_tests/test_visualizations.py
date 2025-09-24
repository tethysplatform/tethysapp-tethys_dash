from tethysapp.tethysdash.visualizations import (
    get_available_visualizations,
    get_visualization,
)
import pytest


def test_get_available_visualizations(
    mock_app_get_ps_db, mock_plugin, mock_plugin_visualization, mocker, test_owner_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.visualizations.App")
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_get_visualization_user_permission = mocker.patch(
        "tethysapp.tethysdash.visualizations.get_visualization_user_permission"
    )
    mock_get_visualization_user_permission.return_value = True
    mock_intake.source.registry = [mock_plugin.name]
    mock_intake.open_package_name = mock_plugin

    available_visualizations = get_available_visualizations(test_owner_user)

    assert available_visualizations == {"visualizations": [mock_plugin_visualization]}


def test_get_available_visualizations2(
    mock_app_get_ps_db,
    mock_plugin,
    mock_plugin2,
    mock_plugin_visualization2,
    mocker,
    test_owner_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.visualizations.App")
    mock_get_visualization_user_permission = mocker.patch(
        "tethysapp.tethysdash.visualizations.get_visualization_user_permission"
    )
    mock_get_visualization_user_permission.return_value = True
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_intake.source.registry = [mock_plugin.name, mock_plugin2.name]
    mock_intake.open_package_name = mock_plugin
    mock_intake.open_package_name2 = mock_plugin2
    mock_intake.open_package_name2.visualization_restricted = False

    available_visualizations = get_available_visualizations(test_owner_user)
    assert available_visualizations == {"visualizations": [mock_plugin_visualization2]}


def test_get_visualization_restricted_and_access(
    mock_app_get_ps_db, mock_plugin, mocker, test_owner_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.visualizations.App")
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_get_visualization_user_permission = mocker.patch(
        "tethysapp.tethysdash.visualizations.get_visualization_user_permission"
    )
    mock_get_visualization_user_permission.return_value = True
    mock_intake.open_package_name = mock_plugin
    mock_intake.open_package_name().read.return_value = "some_data"
    mock_intake.open_package_name.visualization_restricted = True

    test_args = {"some_arg": "test"}
    viz_type, viz_data = get_visualization(mock_plugin.name, test_args, test_owner_user)

    mock_intake.open_package_name.assert_called_with(some_arg="test")
    assert viz_type == mock_plugin.visualization_type
    assert viz_data == "some_data"


def test_get_visualization_restricted_and_no_access(
    mock_app_get_ps_db, mock_plugin, mocker, test_owner_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.visualizations.App")
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_get_visualization_user_permission = mocker.patch(
        "tethysapp.tethysdash.visualizations.get_visualization_user_permission"
    )
    mock_get_visualization_user_permission.return_value = False
    mock_intake.open_package_name = mock_plugin
    mock_intake.open_package_name().read.return_value = "some_data"
    mock_intake.open_package_name.visualization_restricted = True

    test_args = {"some_arg": "test"}
    with pytest.raises(Exception) as excinfo:
        get_visualization(mock_plugin.name, test_args, test_owner_user)
    assert "User does not have permission to access this visualization." in str(
        excinfo.value
    )


def test_get_visualization_not_restricted(mock_plugin2, mocker, test_owner_user):
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_intake.open_package_name2 = mock_plugin2
    mock_intake.open_package_name2().read.return_value = "some_data"
    mock_intake.open_package_name2.visualization_restricted = False

    test_args = {"some_arg": "test"}
    viz_type, viz_data = get_visualization(
        mock_plugin2.name, test_args, test_owner_user
    )

    mock_intake.open_package_name2.assert_called_with(some_arg="test")
    assert viz_type == mock_plugin2.visualization_type
    assert viz_data == "some_data"
