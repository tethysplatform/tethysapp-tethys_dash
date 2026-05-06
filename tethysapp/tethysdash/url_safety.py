"""URL-safety helpers for outbound requests originating from user-supplied
input (MCP tool args, builder source props, etc.).

Plan reference: docs/plans/2026-05-05-004-feat-mcp-map-layer-builder-parity-plan.md
S1 (SSRF guard).

Goal: prevent SSRF via editor-supplied URLs in MCP map-layer creation.
The chatbox is editor-only, but editors are still legitimate insiders;
SSRF at editor privilege is enough to leak cloud-instance metadata,
probe internal services, or scan internal infrastructure.
"""
from __future__ import annotations

import ipaddress
import os
import socket
from typing import Optional
from urllib.parse import urlparse


# Schemes the dispatcher accepts for outbound HTTP fetches.
_ALLOWED_SCHEMES = frozenset({"http", "https"})


def _trusted_hosts() -> set[str]:
    """Hosts that bypass private-IP rejection. Configured via the
    ``TETHYSDASH_TRUSTED_HOSTS`` env var (comma-separated). Use for
    on-prem ArcGIS/WMS deployments.
    """
    raw = os.environ.get("TETHYSDASH_TRUSTED_HOSTS", "")
    return {h.strip() for h in raw.split(",") if h.strip()}


def _is_internal_address(host: str) -> bool:
    """True if ``host`` resolves to an RFC 1918 / loopback / link-local
    address. Resolves the host via DNS; on resolution failure, returns
    True (fail-closed).
    """
    if not host:
        return True

    # Try interpreting as a literal IP first (avoids DNS for ip addresses).
    try:
        ip = ipaddress.ip_address(host)
        return _is_private_ip(ip)
    except ValueError:
        pass

    # Resolve hostname to IP. If DNS fails, fail closed.
    try:
        infos = socket.getaddrinfo(host, None)
    except (socket.gaierror, UnicodeError):
        return True

    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            continue
        if _is_private_ip(ip):
            return True

    return False


def _is_private_ip(ip: ipaddress._BaseAddress) -> bool:
    """RFC 1918 / loopback / link-local / unique-local check covering
    both IPv4 and IPv6.
    """
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_unspecified
        or ip.is_reserved
        or ip.is_multicast
    )


class UnsafeUrlError(ValueError):
    """Raised when an outbound URL is rejected by the safety guard."""


def validate_outbound_url(url: Optional[str]) -> None:
    """Validate that ``url`` is safe to fetch server-side from a user-supplied
    context. Raises UnsafeUrlError on rejection.

    Rejects:
      - Non-http(s) schemes (file://, gopher://, dict://, ftp://, javascript://, …)
      - URLs whose host resolves to a private/loopback/link-local IP
      - URLs with no host

    Bypass: hosts listed in the ``TETHYSDASH_TRUSTED_HOSTS`` env var skip
    the private-IP check (operator-controlled allowlist for on-prem
    geospatial services).
    """
    if not url or not isinstance(url, str):
        raise UnsafeUrlError("URL is empty or not a string.")

    parsed = urlparse(url)

    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        raise UnsafeUrlError(
            f"URL scheme {parsed.scheme!r} is not allowed. "
            f"Allowed: {sorted(_ALLOWED_SCHEMES)}"
        )

    host = parsed.hostname
    if not host:
        raise UnsafeUrlError(f"URL is missing a host: {url!r}")

    if host in _trusted_hosts():
        return

    if _is_internal_address(host):
        raise UnsafeUrlError(
            f"URL host {host!r} resolves to a private/loopback/link-local "
            f"address; refusing to fetch. Add the host to "
            f"TETHYSDASH_TRUSTED_HOSTS to bypass for on-prem deployments."
        )


# Cap on outbound requests inside a single tool invocation. Some ArcGIS
# Image services advertise hundreds of layers; the per-layer attribute
# fetch loop can amplify a single MCP call into N+1 outbound requests.
# Cap matches what a "normal" service descriptor returns; pathological
# services fall back to default-visibility behavior.
MAX_OUTBOUND_REQUESTS_PER_CALL = 50
