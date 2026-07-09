"""Thin Nominatim geocoder for chat-tool place-name resolution.

Mirrors the tethysdash-MCP's ``_geocode`` helper. Fails soft — returns
``None`` when the place isn't found or the network call fails, so the
caller can return a helpful error message instead of crashing.

Nominatim rate-limits at ~1 req/s per IP and requires a User-Agent
header identifying the app.
"""
from __future__ import annotations

import httpx

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_USER_AGENT = "tethysdash-chat/0.1 (https://github.com/tethysplatform/tethysapp-tethys_dash)"


def geocode(place: str) -> tuple[float, float] | None:
    """Return ``(lon, lat)`` for a place name, or ``None`` if unresolvable."""
    place = (place or "").strip()
    if not place:
        return None
    try:
        r = httpx.get(
            _NOMINATIM_URL,
            params={"q": place, "format": "json", "limit": 1},
            headers={"User-Agent": _USER_AGENT},
            timeout=5.0,
        )
        r.raise_for_status()
        results = r.json()
        if not results:
            return None
        return float(results[0]["lon"]), float(results[0]["lat"])
    except Exception:
        return None
