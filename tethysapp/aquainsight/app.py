from tethys_sdk.base import TethysAppBase


class App(TethysAppBase):
    """
    Tethys app class for Aqua Insight.
    """

    name = 'Aqua Insight'
    description = ''
    package = 'aquainsight'  # WARNING: Do not change this value
    index = 'home'
    icon = f'{package}/images/icon.gif'
    root_url = 'aquainsight'
    color = '#718093'
    tags = ''
    enable_feedback = False
    feedback_emails = []