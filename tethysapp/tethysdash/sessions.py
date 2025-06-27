"""
This is a version of SessionSecurityMiddleware without MiddlewareMixin dependency.

For full docs: https://django-session-security.readthedocs.io/en/latest/index.html
"""

from datetime import datetime, timedelta
import django
from django.urls import reverse, resolve, Resolver404
from django.conf import settings


class SessionSecurityMiddleware:
    """
    Maintains 'last activity' timestamps and logs out users when idle too long.
    """

    def __init__(self):
        try:
            from session_security.utils import get_last_activity, set_last_activity
            from session_security.settings import (
                EXPIRE_AFTER,
                PASSIVE_URLS,
                PASSIVE_URL_NAMES,
            )
        except ImportError as error:
            raise NameError(
                "session_security is not installed or misconfigured"
            ) from error

        self.get_last_activity = get_last_activity
        self.set_last_activity = set_last_activity
        self.expire_after = getattr(
            settings, "SESSION_SECURITY_EXPIRE_AFTER", EXPIRE_AFTER
        )
        self.warn_after = getattr(
            settings, "SESSION_SECURITY_WARN_AFTER", self.expire_after - 60
        )
        self.passive_urls = PASSIVE_URLS
        self.passive_url_names = PASSIVE_URL_NAMES

    def is_passive_request(self, request):
        """Should we skip activity update on this URL/View?"""
        if request.path in self.passive_urls:
            return True

        try:
            match = resolve(request.path)
            if match.url_name in self.passive_url_names:
                return True
        except Resolver404:
            pass

        return False

    def get_expire_seconds(self, request):
        """Return seconds before logout."""
        return self.expire_after

    def is_user_session_expired(self, request, now=None):
        now = now or datetime.now()
        last_activity = self.get_last_activity(request.session)

        if not last_activity:
            return False  # Defensive fallback

        delta = now - last_activity
        return delta >= timedelta(seconds=self.get_expire_seconds(request))

    def process_request(self, request):
        """Update last activity or trigger logout."""
        if django.VERSION < (1, 10):
            is_authenticated = request.user.is_authenticated()
        else:
            is_authenticated = request.user.is_authenticated

        if not is_authenticated:
            return -2

        now = datetime.now()

        if "_session_security" not in request.session:
            self.set_last_activity(request.session, now)
            return

        if self.is_user_session_expired(request, now):
            return -1

        if request.path == reverse("tethysdash:ping"):
            self.update_last_activity(request, now)
        elif not self.is_passive_request(request):
            self.set_last_activity(request.session, now)

    def update_last_activity(self, request, now):
        """
        If request.GET['idleFor'] < server idle time, update session last activity.
        """
        last_activity = self.get_last_activity(request.session)
        if not last_activity:
            return

        server_idle_for = (now - last_activity).seconds
        client_idle_for = int(request.GET["idleFor"])

        if client_idle_for < 0:
            client_idle_for = 0

        if client_idle_for < server_idle_for:
            last_activity = now - timedelta(seconds=client_idle_for)

        self.set_last_activity(request.session, last_activity)
