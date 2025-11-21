from tethys_sdk.base import TethysAppBase
from tethys_sdk.app_settings import PersistentStoreDatabaseSetting, CustomSetting
from tethys_sdk.permissions import Permission


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

    def permissions(self):
        manage_visualizations = Permission(
            name="manage_visualizations", description="Manage visualizations"
        )

        permissions = (manage_visualizations,)

        return permissions

    def custom_settings(self):
        """
        Example custom_settings method.
        """
        custom_settings = (
            CustomSetting(
                name="support_email",
                type=CustomSetting.TYPE_STRING,
                description="Support email address",
                required=True,
                default="ckrewson@aquaveo.com",
            ),
            CustomSetting(
                name="support_github",
                type=CustomSetting.TYPE_STRING,
                description="Support GitHub URL",
                required=False,
                default="https://github.com/tethysplatform/tethysapp-tethys_dash/issues",  # noqa E501
            ),
        )

        return custom_settings
