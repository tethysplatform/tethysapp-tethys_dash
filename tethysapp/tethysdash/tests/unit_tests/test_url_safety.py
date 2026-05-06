"""Tests for the SSRF guard introduced in plan 004 C1."""
import os

import pytest

from tethysapp.tethysdash.url_safety import (
    MAX_OUTBOUND_REQUESTS_PER_CALL,
    UnsafeUrlError,
    validate_outbound_url,
)


# ---------------------------------------------------------------------------
# Scheme allowlist
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "gopher://example.com/x",
        "dict://example.com/lookup",
        "ftp://files.example.com/archive.zip",
        "javascript:alert(1)",
        "data:text/plain,hello",
    ],
)
def test_rejects_non_http_schemes(url):
    with pytest.raises(UnsafeUrlError, match="not allowed"):
        validate_outbound_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "https://services.arcgisonline.com/arcgis/rest/services/MapServer",
        "http://example.com/data.geojson",
        "https://example.com:8443/path?q=1",
    ],
)
def test_accepts_http_https_to_public_hosts(url, monkeypatch):
    # Avoid DNS dependency in the unit test by stubbing the resolver
    # to return a known-public address.
    import socket

    monkeypatch.setattr(
        socket, "getaddrinfo", lambda *a, **kw: [(2, 1, 6, "", ("93.184.216.34", 0))]
    )
    validate_outbound_url(url)  # should not raise


# ---------------------------------------------------------------------------
# Private/internal address rejection
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/admin",
        "http://localhost/metadata",
        "http://10.0.0.1/",
        "http://172.16.0.1/",
        "http://192.168.1.1/",
        "http://169.254.169.254/latest/meta-data/",  # AWS IMDS
        "http://[::1]/",
        "http://[fe80::1]/",
    ],
)
def test_rejects_literal_private_ips(url):
    with pytest.raises(UnsafeUrlError, match="private"):
        validate_outbound_url(url)


def test_rejects_when_dns_resolves_to_private_ip(monkeypatch):
    import socket

    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *a, **kw: [(2, 1, 6, "", ("10.0.0.5", 0))],
    )
    with pytest.raises(UnsafeUrlError, match="private"):
        validate_outbound_url("https://attacker-rebind.example.com/probe")


def test_fail_closed_on_dns_failure(monkeypatch):
    import socket

    def _raise(*a, **kw):
        raise socket.gaierror("DNS fail")

    monkeypatch.setattr(socket, "getaddrinfo", _raise)
    with pytest.raises(UnsafeUrlError, match="private"):
        validate_outbound_url("https://nonexistent.example.invalid/")


# ---------------------------------------------------------------------------
# Empty / malformed input
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("value", [None, "", 0, 123, []])
def test_rejects_empty_or_non_string(value):
    with pytest.raises(UnsafeUrlError, match="empty or not a string"):
        validate_outbound_url(value)


def test_rejects_url_without_host():
    with pytest.raises(UnsafeUrlError, match="missing a host"):
        validate_outbound_url("https:///")


# ---------------------------------------------------------------------------
# Trusted-host bypass
# ---------------------------------------------------------------------------


def test_trusted_hosts_env_bypasses_private_ip_check(monkeypatch):
    # On-prem ArcGIS server with an internal IP, listed in trusted hosts.
    import socket

    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *a, **kw: [(2, 1, 6, "", ("10.20.30.40", 0))],
    )
    monkeypatch.setenv("TETHYSDASH_TRUSTED_HOSTS", "arcgis.internal,gis.corp.example")
    validate_outbound_url("https://arcgis.internal/MapServer")  # should not raise


def test_untrusted_internal_host_still_rejected_when_env_set(monkeypatch):
    import socket

    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *a, **kw: [(2, 1, 6, "", ("10.20.30.40", 0))],
    )
    monkeypatch.setenv("TETHYSDASH_TRUSTED_HOSTS", "arcgis.internal")
    with pytest.raises(UnsafeUrlError, match="private"):
        validate_outbound_url("https://other-internal.host/MapServer")


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------


def test_outbound_request_cap_is_finite():
    assert isinstance(MAX_OUTBOUND_REQUESTS_PER_CALL, int)
    assert 1 <= MAX_OUTBOUND_REQUESTS_PER_CALL <= 1000
