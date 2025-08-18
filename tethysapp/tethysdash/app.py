from tethys_sdk.base import TethysAppBase
from tethys_sdk.app_settings import PersistentStoreDatabaseSetting
from tethys_sdk.permissions import Permission, PermissionGroup


class App(TethysAppBase):
    """
    Tethys app class for TethysDash.
    """

    name = "TethysDash"
    description = ""
    package = "tethysdash"  # WARNING: Do not change this value
    index = "home"
    icon = f"{package}/images/tethys_dash.png"
    catch_all = "home"  # required for react browser routing
    root_url = "tethysdash"
    color = ""  # Don't set color here, set it in reactapp/custom-bootstrap.scss
    tags = ""
    enable_feedback = False
    feedback_emails = []

    # TODO: Create a custom permissions model for permission groups and dashboard permissions

    # def permissions(self):
    #     create_permission_group = Permission(
    #         name="create_permission_group", description="Create permission group"
    #     )

    #     delete_permission_group = Permission(
    #         name="delete_permission_group", description="Delete permission group"
    #     )

    #     manage_users_in_permission_group = Permission(
    #         name="manage_users_in_permission_group",
    #         description="Manage users in permission group",
    #     )

    #     edit_dashboard = Permission(name="edit_dashboard", description="Edit dashboard")

    #     view_dashboard = Permission(name="view_dashboard", description="View dashboard")

    #     permission_group_admin = PermissionGroup(
    #         name="permission_group_admin",
    #         permissions=(
    #             create_permission_group,
    #             delete_permission_group,
    #             manage_users_in_permission_group,
    #         ),
    #     )

    #     permission_group_editor = PermissionGroup(
    #         name="permission_group_editor",
    #         permissions=(delete_permission_group, manage_users_in_permission_group),
    #     )

    #     dashboard_editor = PermissionGroup(
    #         name="dashboard_editor",
    #         permissions=(edit_dashboard, view_dashboard),
    #     )

    #     permissions = (
    #         permission_group_admin,
    #         permission_group_editor,
    #         dashboard_editor,
    #         view_dashboard,
    #     )

    #     return permissions

    def persistent_store_settings(self):
        """
        Define Persistent Store Settings.
        """
        ps_settings = (
            PersistentStoreDatabaseSetting(
                name="primary_db",
                description="primary database",
                initializer="tethysdash.model.init_primary_db",
                required=True,
            ),
        )

        return ps_settings
