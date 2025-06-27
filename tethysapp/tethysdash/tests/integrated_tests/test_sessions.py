import pytest
from datetime import datetime, timedelta
from django.contrib.auth.models import AnonymousUser, User
from django.test import RequestFactory
from django.urls import reverse
from django.conf import settings
from types import SimpleNamespace
from django.urls import ResolverMatch


@pytest.fixture
def rf():
    return RequestFactory()


@pytest.fixture
def authenticated_request(rf, db):
    user = User.objects.create_user("testuser", "test@example.com", "testpass")
    request = rf.get("/")
    request.user = user
    request.session = {}
    return request


@pytest.fixture
def anonymous_request(rf):
    request = rf.get("/")
    request.user = AnonymousUser()
    request.session = {}
    return request


def test_authenticated_sets_last_activity(mocker, authenticated_request):
    now = datetime.now()
    fake_utils = SimpleNamespace(
        get_last_activity=mocker.Mock(return_value=now - timedelta(seconds=1)),
        set_last_activity=mocker.Mock(),
    )
    fake_settings = SimpleNamespace(
        EXPIRE_AFTER=600, PASSIVE_URLS=[], PASSIVE_URL_NAMES=[]
    )

    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": mocker.Mock(),
            "session_security.utils": fake_utils,
            "session_security.settings": fake_settings,
            "session_security.urls": SimpleNamespace(urlpatterns=[]),
        },
    )

    from tethysapp.tethysdash.sessions import SessionSecurityMiddleware

    middleware = SessionSecurityMiddleware()

    authenticated_request.session["_session_security"] = {}
    result = middleware.process_request(authenticated_request)

    assert result is None
    fake_utils.set_last_activity.assert_called()


def test_anonymous_user_returns_minus_2(mocker, anonymous_request):
    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": mocker.Mock(),
            "session_security.utils": SimpleNamespace(
                get_last_activity=mocker.Mock(), set_last_activity=mocker.Mock()
            ),
            "session_security.settings": SimpleNamespace(
                EXPIRE_AFTER=600, PASSIVE_URLS=[], PASSIVE_URL_NAMES=[]
            ),
        },
    )

    from tethysapp.tethysdash.sessions import SessionSecurityMiddleware

    middleware = SessionSecurityMiddleware()
    result = middleware.process_request(anonymous_request)
    assert result == -2


def test_no_last_activity(mocker, authenticated_request):
    expire_after = getattr(settings, "SESSION_SECURITY_EXPIRE_AFTER", 600)

    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": mocker.Mock(),
            "session_security.utils": SimpleNamespace(
                get_last_activity=mocker.Mock(return_value=None),
                set_last_activity=mocker.Mock(),
            ),
            "session_security.settings": SimpleNamespace(
                EXPIRE_AFTER=expire_after, PASSIVE_URLS=[], PASSIVE_URL_NAMES=[]
            ),
            "session_security.urls": SimpleNamespace(urlpatterns=[]),
        },
    )

    authenticated_request.session["_session_security"] = {}

    from tethysapp.tethysdash.sessions import SessionSecurityMiddleware

    middleware = SessionSecurityMiddleware()
    result = middleware.process_request(authenticated_request)

    assert result is None


def test_expired_session_detected(mocker, authenticated_request):
    expire_after = getattr(settings, "SESSION_SECURITY_EXPIRE_AFTER", 600)
    old_activity = datetime.now() - timedelta(seconds=expire_after + 10)

    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": mocker.Mock(),
            "session_security.utils": SimpleNamespace(
                get_last_activity=mocker.Mock(return_value=old_activity),
                set_last_activity=mocker.Mock(),
            ),
            "session_security.settings": SimpleNamespace(
                EXPIRE_AFTER=expire_after, PASSIVE_URLS=[], PASSIVE_URL_NAMES=[]
            ),
        },
    )

    authenticated_request.session["_session_security"] = {}

    from tethysapp.tethysdash.sessions import SessionSecurityMiddleware

    middleware = SessionSecurityMiddleware()
    result = middleware.process_request(authenticated_request)

    assert result == -1


def test_process_request_old_django_version(mocker):
    expire_after = getattr(settings, "SESSION_SECURITY_EXPIRE_AFTER", 600)
    old_activity = datetime.now() - timedelta(seconds=expire_after + 10)

    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": mocker.Mock(),
            "session_security.utils": SimpleNamespace(
                get_last_activity=mocker.Mock(return_value=old_activity),
                set_last_activity=mocker.Mock(),
            ),
            "session_security.settings": SimpleNamespace(
                EXPIRE_AFTER=expire_after, PASSIVE_URLS=[], PASSIVE_URL_NAMES=[]
            ),
        },
    )

    # Re-import after patching
    from tethysapp.tethysdash.sessions import SessionSecurityMiddleware

    middleware = SessionSecurityMiddleware()

    # Patch django.VERSION to simulate Django < 1.10
    mocker.patch("django.VERSION", new=(1, 9, 0))

    # Create a fake request with user.is_authenticated() as a callable
    class FakeUser:
        def is_authenticated(self):
            return True

    class FakeRequest:
        user = FakeUser()
        session = {"_session_security": {}}
        path = "/"

    request = FakeRequest()

    # Call process_request, just to trigger the is_authenticated() path
    result = middleware.process_request(request)

    assert result == -1


def test_idle_for_updates_last_activity(mocker, authenticated_request):
    now = datetime.now()
    old_activity = now - timedelta(seconds=1)

    set_last_activity_mock = mocker.Mock()
    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": mocker.Mock(),
            "session_security.utils": SimpleNamespace(
                get_last_activity=mocker.Mock(return_value=old_activity),
                set_last_activity=set_last_activity_mock,
            ),
            "session_security.settings": SimpleNamespace(
                EXPIRE_AFTER=600, PASSIVE_URLS=[], PASSIVE_URL_NAMES=[]
            ),
            "session_security.urls": SimpleNamespace(urlpatterns=[]),
        },
    )

    authenticated_request.GET = {"idleFor": "50"}
    authenticated_request.path = reverse("tethysdash:ping")
    authenticated_request.session["_session_security"] = {}

    from tethysapp.tethysdash.sessions import SessionSecurityMiddleware

    middleware = SessionSecurityMiddleware()
    middleware.process_request(authenticated_request)

    assert set_last_activity_mock.call_count == 1


def test_passive_url_does_not_update(mocker, authenticated_request):
    now = datetime.now()
    set_last_activity_mock = mocker.Mock()

    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": mocker.Mock(),
            "session_security.utils": SimpleNamespace(
                get_last_activity=mocker.Mock(return_value=now),
                set_last_activity=set_last_activity_mock,
            ),
            "session_security.settings": SimpleNamespace(
                EXPIRE_AFTER=600, PASSIVE_URLS=["/passive/"], PASSIVE_URL_NAMES=[]
            ),
        },
    )

    authenticated_request.path = "/passive/"
    authenticated_request.session["_session_security"] = {}

    from tethysapp.tethysdash.sessions import SessionSecurityMiddleware

    middleware = SessionSecurityMiddleware()
    middleware.process_request(authenticated_request)

    set_last_activity_mock.assert_not_called()


def test_is_passive_request_with_url_name(mocker):
    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": mocker.Mock(),
            "session_security.utils": SimpleNamespace(
                get_last_activity=mocker.Mock(),
                set_last_activity=mocker.Mock(),
            ),
            "session_security.settings": SimpleNamespace(
                EXPIRE_AFTER=600,
                PASSIVE_URLS=[],
                PASSIVE_URL_NAMES=["home"],
            ),
        },
    )

    from tethysapp.tethysdash.sessions import SessionSecurityMiddleware

    middleware = SessionSecurityMiddleware()

    # Create a fake request with some arbitrary path
    class FakeRequest:
        path = "/"

    request = FakeRequest()

    # Create a ResolverMatch mock with url_name in passive_url_names
    fake_match = ResolverMatch(
        func=None,
        args=(),
        kwargs={},
        url_name="home",
        app_names=[],
        namespaces=[],
    )

    mocker.patch("django.urls.resolve", return_value=fake_match)

    result = middleware.is_passive_request(request)

    assert result is True


def test_is_passive_request_404(mocker):
    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": mocker.Mock(),
            "session_security.utils": SimpleNamespace(
                get_last_activity=mocker.Mock(),
                set_last_activity=mocker.Mock(),
            ),
            "session_security.settings": SimpleNamespace(
                EXPIRE_AFTER=600,
                PASSIVE_URLS=[],
                PASSIVE_URL_NAMES=["asdafasdf"],
            ),
        },
    )

    from tethysapp.tethysdash.sessions import SessionSecurityMiddleware

    middleware = SessionSecurityMiddleware()

    # Create a fake request with some arbitrary path
    class FakeRequest:
        path = "/sdfsfsdf/"

    request = FakeRequest()

    # Create a ResolverMatch mock with url_name in passive_url_names
    fake_match = ResolverMatch(
        func=None,
        args=(),
        kwargs={},
        url_name="asdafasdf",
        app_names=[],
        namespaces=[],
    )

    mocker.patch("django.urls.resolve", return_value=fake_match)

    result = middleware.is_passive_request(request)

    assert result is False


def test__session_security_not_in_request(mocker, authenticated_request):
    set_last_activity_mock = mocker.Mock()
    get_last_activity_mock = mocker.Mock()

    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": mocker.Mock(),
            "session_security.utils": SimpleNamespace(
                get_last_activity=get_last_activity_mock,
                set_last_activity=set_last_activity_mock,
            ),
            "session_security.settings": SimpleNamespace(
                EXPIRE_AFTER=600,
                PASSIVE_URLS=[],
                PASSIVE_URL_NAMES=[],
            ),
        },
    )

    # authenticated_request is preconfigured with a valid user
    # DO NOT set `_session_security` in the session here
    authenticated_request.session = {}

    from tethysapp.tethysdash.sessions import SessionSecurityMiddleware

    middleware = SessionSecurityMiddleware()

    result = middleware.process_request(authenticated_request)

    # Since _session_security was not present, it should set and return early
    assert set_last_activity_mock.called
    assert result is None


def test_update_last_activity_skips_if_no_last_activity(mocker, authenticated_request):
    now = datetime.now()

    set_last_activity_mock = mocker.Mock()
    get_last_activity_mock = mocker.Mock(return_value=None)

    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": mocker.Mock(),
            "session_security.utils": SimpleNamespace(
                get_last_activity=get_last_activity_mock,
                set_last_activity=set_last_activity_mock,
            ),
            "session_security.settings": SimpleNamespace(
                EXPIRE_AFTER=600,
                PASSIVE_URLS=[],
                PASSIVE_URL_NAMES=[],
            ),
        },
    )

    authenticated_request.GET = {"idleFor": "50"}
    authenticated_request.session["_session_security"] = {}

    from tethysapp.tethysdash.sessions import SessionSecurityMiddleware

    middleware = SessionSecurityMiddleware()
    middleware.update_last_activity(authenticated_request, now)

    # Ensure it exited early without trying to update
    set_last_activity_mock.assert_not_called()


def test_update_last_activity_resets_negative_idle_for(mocker, authenticated_request):
    now = datetime.now()

    # Simulate last activity 30 seconds ago
    get_last_activity_mock = mocker.Mock(return_value=now - timedelta(seconds=30))
    set_last_activity_mock = mocker.Mock()

    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": mocker.Mock(),
            "session_security.utils": SimpleNamespace(
                get_last_activity=get_last_activity_mock,
                set_last_activity=set_last_activity_mock,
            ),
            "session_security.settings": SimpleNamespace(
                EXPIRE_AFTER=600,
                PASSIVE_URLS=[],
                PASSIVE_URL_NAMES=[],
            ),
        },
    )

    # Provide negative idleFor
    authenticated_request.GET = {"idleFor": "-100"}
    authenticated_request.session["_session_security"] = {}

    from tethysapp.tethysdash.sessions import SessionSecurityMiddleware

    middleware = SessionSecurityMiddleware()
    middleware.update_last_activity(authenticated_request, now)

    # The set_last_activity should be called with now - timedelta(0) == now
    set_last_activity_mock.assert_called_once()
    args, _ = set_last_activity_mock.call_args
    last_activity_updated = args[1]
    assert abs((last_activity_updated - now).total_seconds()) < 1


def test_missing_session_security_module_raises_nameerror(mocker):
    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": None,
            "session_security.utils": None,
            "session_security.settings": None,
        },
    )

    from tethysapp.tethysdash import sessions

    with pytest.raises(NameError, match="session_security is not installed"):
        sessions.SessionSecurityMiddleware()
