"""Server-side URL validation (SSRF guard).

The floodmap endpoints fetch a caller-supplied URL server-side, so we must
reject anything that could reach internal/loopback/link-local/cloud-metadata
addresses. Only public http/https hosts are allowed.
"""

import ipaddress
import socket
from urllib.parse import urlparse

ALLOWED_SCHEMES = ("http", "https")


class UnsafeURLError(Exception):
    """A URL was rejected as unsafe for the server to fetch."""


def _resolve_ips(host):
    infos = socket.getaddrinfo(host, None)
    return {ipaddress.ip_address(info[4][0]) for info in infos}


def _is_blocked(ip):
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local  # includes 169.254.169.254 cloud metadata
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def validate_public_url(url):
    """Return ``url`` if safe to fetch server-side, else raise UnsafeURLError."""
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise UnsafeURLError(f"scheme '{parsed.scheme}' is not allowed")
    host = parsed.hostname
    if not host:
        raise UnsafeURLError("URL has no host")
    try:
        ips = _resolve_ips(host)
    except socket.gaierror as e:
        raise UnsafeURLError(f"could not resolve host '{host}'") from e
    for ip in ips:
        if _is_blocked(ip):
            raise UnsafeURLError(f"host '{host}' resolves to blocked address {ip}")
    return url
