"""Unit tests for the SSRF URL guard. DNS resolution is stubbed so tests are
hermetic and deterministic."""

import socket

import pytest

from tethysapp.tethysdash import url_safety
from tethysapp.tethysdash.url_safety import UnsafeURLError, validate_public_url


def _stub_dns(monkeypatch, ip):
    def fake_getaddrinfo(host, *args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 0))]

    monkeypatch.setattr(url_safety.socket, "getaddrinfo", fake_getaddrinfo)


def test_public_host_is_allowed(monkeypatch):
    _stub_dns(monkeypatch, "93.184.216.34")
    url = "https://example.s3.us-east-1.amazonaws.com/floodmaps/"
    assert validate_public_url(url) == url


@pytest.mark.parametrize(
    "ip",
    [
        "127.0.0.1",        # loopback
        "10.0.0.5",         # private
        "172.16.0.1",       # private
        "192.168.1.1",      # private
        "169.254.169.254",  # link-local / cloud metadata
        "0.0.0.0",          # unspecified
    ],
)
def test_blocked_addresses_are_rejected(monkeypatch, ip):
    _stub_dns(monkeypatch, ip)
    with pytest.raises(UnsafeURLError, match="blocked address"):
        validate_public_url("https://evil.example.com/x")


@pytest.mark.parametrize("url", ["file:///etc/passwd", "s3://bucket/key", "ftp://h/x"])
def test_disallowed_schemes_are_rejected(url):
    with pytest.raises(UnsafeURLError, match="not allowed"):
        validate_public_url(url)


def test_missing_host_is_rejected():
    with pytest.raises(UnsafeURLError, match="no host"):
        validate_public_url("https://")


def test_unresolvable_host_is_rejected(monkeypatch):
    def boom(host, *args, **kwargs):
        raise socket.gaierror("nope")

    monkeypatch.setattr(url_safety.socket, "getaddrinfo", boom)
    with pytest.raises(UnsafeURLError, match="could not resolve"):
        validate_public_url("https://does-not-exist.example/x")
