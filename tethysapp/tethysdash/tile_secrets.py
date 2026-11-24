"""Encrypting the values of plugins' secret args, and keeping them out of text.

A secret's value is stored encrypted, in a
:class:`~tethysapp.tethysdash.model.TileSecret` row, under a key ring:

1. each key in the optional ``TETHYSDASH_SECRET_KEYS`` Django setting, a list of Fernet
   keys, which ``portal_config.yml`` can set;
2. a key derived from ``SECRET_KEY``, then one from each ``SECRET_KEY_FALLBACKS`` entry.

The first key encrypts, and any key decrypts. So adding a dedicated key ahead of the
derived ones keeps every stored value readable, and rotating ``SECRET_KEY`` keeps them
readable as long as the old key stays in ``SECRET_KEY_FALLBACKS``.

What is encrypted is the value together with its identity: the dashboard, tile, layer,
arg and plugin source it was entered for. A value read back under any other identity is
refused, so a row that ends up elsewhere never hands its value to another tile or
plugin.

A value in hand travels as a :class:`SecretValue`, whose ``repr`` and ``str`` never show
it, and any text bound for a browser or a log goes through :func:`redact` first. This
module logs a secret's place, never its value.

Named ``tile_secrets`` rather than ``secrets``, which would shadow the standard library.
"""

import base64
import json
import re
from dataclasses import dataclass, fields
from urllib.parse import quote, quote_plus

from cryptography.fernet import Fernet, MultiFernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils.encoding import force_bytes
from django.views.decorators.debug import sensitive_variables

# The HKDF label for keys derived from SECRET_KEY. It gives this use its own key, apart
# from anything else derived from SECRET_KEY. Changing it loses every stored secret.
KEY_PURPOSE = b"tethysdash/tile-secrets/v1"

# What text shows in place of a secret.
REDACTED = "[redacted]"

# Shorter values are not redacted: they turn up by chance in ordinary text, where
# masking them would garble messages, and the gaps could give the value away.
MIN_REDACTED_LENGTH = 4

# A URL's password, as in scheme://user:password@host. A password may hold an "@" that
# should have been escaped, so the match runs to the last "@" before the URL's path.
#
# The match starts at the "://", with only the character before it checked as one a
# scheme may end with. Matching the scheme itself made every letter of a long run a
# start that read to the run's end, which took quadratic time. From the "://" the
# match reads no further than the next "/", so each part of the text is read once.
# Whatever comes before that character, a password is masked: a scheme run into other
# text ("404-https://") or one that does not start with a letter included.
_URL_PASSWORD = re.compile(
    r"(?<=[A-Za-z0-9+.\-])(?P<prefix>://[^\s/?#@:\"]*:)[^\s/?#\"]+@"
)

_warned_derived_keys_only = False


class SecretValue:
    """
    A secret's value, held so that printing or logging the holder never shows it.

    ``repr`` and ``str`` show :data:`REDACTED`; :meth:`reveal` returns the value.
    """

    __slots__ = ("_value",)

    def __init__(self, value):
        self._value = value

    def reveal(self):
        """Return the value itself."""
        return self._value

    def __repr__(self):
        return f"SecretValue({REDACTED})"

    __str__ = __repr__


@dataclass(frozen=True)
class SecretIdentity:
    """
    The place a secret's value was entered for, which its ciphertext is bound to.

    Every field is kept as a string, and a missing layer as "".

    Attributes:
        dashboard (str): The dashboard's uuid
        tile (str): The tile's uuid, top-level or in a Map tile's layer popup
        layer (str): A dynamic layer's ``layerId`` within the tile, or "" for an arg of
            the tile itself
        arg (str): The secret arg's name
        source (str): The plugin source the value was entered for
    """

    dashboard: str
    tile: str
    layer: str
    arg: str
    source: str

    def __post_init__(self):
        object.__setattr__(self, "layer", self.layer or "")
        for field in fields(self):
            object.__setattr__(self, field.name, str(getattr(self, field.name)))

    def as_dict(self):
        """The identity's fields, as stored with the value."""
        return {field.name: getattr(self, field.name) for field in fields(self)}

    def __str__(self):
        layer = f" layer {self.layer}" if self.layer else ""
        return (
            f"dashboard {self.dashboard} tile {self.tile}{layer} arg {self.arg!r} "
            f"(plugin {self.source})"
        )


class SecretUnavailable(Exception):
    """
    Raised when a stored secret cannot be read: no key in the ring opens it, it has been
    altered, or it was stored for another identity. Its message names the secret's
    place, never its value, and asks for the secret to be entered again.

    Attributes:
        identity (SecretIdentity): The place the secret was asked for
    """

    def __init__(self, identity):
        super().__init__(identity)
        self.identity = identity

    def __str__(self):
        return f"The secret for {self.identity} can't be read. Enter it again."


def _derived_key(secret_key):
    """A Fernet key derived from a Django secret key, for this module's use only."""
    hkdf = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=KEY_PURPOSE)
    return base64.urlsafe_b64encode(hkdf.derive(force_bytes(secret_key)))


def _dedicated_keys():
    keys = getattr(settings, "TETHYSDASH_SECRET_KEYS", None) or ()
    if isinstance(keys, (str, bytes)):
        keys = (keys,)
    return list(keys)


def _key_ring():
    """
    Return the key ring, and whether it holds a dedicated key.

    Raises:
        ImproperlyConfigured: An entry of ``TETHYSDASH_SECRET_KEYS`` is not a Fernet
            key. The message gives its position, never the entry.
    """
    ring = []
    for position, key in enumerate(_dedicated_keys()):
        try:
            ring.append(Fernet(key))
        except (TypeError, ValueError):
            raise ImproperlyConfigured(
                f"Entry {position} of TETHYSDASH_SECRET_KEYS is not a Fernet key. "
                "Generate one with cryptography.fernet.Fernet.generate_key()."
            ) from None
    dedicated = bool(ring)
    for secret_key in (settings.SECRET_KEY, *settings.SECRET_KEY_FALLBACKS):
        ring.append(Fernet(_derived_key(secret_key)))
    return MultiFernet(ring), dedicated


def _warn_derived_keys_only():
    """Warn, once per process, that the stored secrets hang on SECRET_KEY."""
    global _warned_derived_keys_only
    if _warned_derived_keys_only:
        return
    _warned_derived_keys_only = True
    print(
        "Warning: TethysDash is encrypting plugin secrets with a key derived from "
        "SECRET_KEY, because TETHYSDASH_SECRET_KEYS is not set. If SECRET_KEY changes "
        "without the old key kept in SECRET_KEY_FALLBACKS, every saved secret becomes "
        "unrecoverable and must be entered again. Set TETHYSDASH_SECRET_KEYS to a list "
        "holding a key from cryptography.fernet.Fernet.generate_key()."
    )


@sensitive_variables()
def encrypt(identity, value):
    """
    Encrypt a secret's value for storage, bound to its identity.

    Args:
        identity (SecretIdentity): The place the value was entered for
        value (str or SecretValue): The value

    Returns:
        str: The ciphertext, encrypted with the first key in the ring

    Raises:
        TypeError: The value is not a string.
        ImproperlyConfigured: ``TETHYSDASH_SECRET_KEYS`` holds something not a key.
    """
    if isinstance(value, SecretValue):
        value = value.reveal()
    if not isinstance(value, str):
        raise TypeError(f"A secret's value must be a string, not {type(value)}.")
    ring, dedicated = _key_ring()
    if not dedicated:
        _warn_derived_keys_only()
    plaintext = json.dumps({**identity.as_dict(), "value": value}, sort_keys=True)
    return ring.encrypt(plaintext.encode("utf-8")).decode("ascii")


@sensitive_variables()
def decrypt(identity, ciphertext):
    """
    Decrypt a stored secret, checking it was stored for this identity.

    Args:
        identity (SecretIdentity): The place the value is asked for
        ciphertext (str): The stored ciphertext

    Returns:
        SecretValue: The value

    Raises:
        SecretUnavailable: The value cannot be read, for any reason: no key in the ring
            opens it, it was altered, what it holds is not a stored secret, or it was
            stored for another identity. The reason is logged with the secret's place.
        ImproperlyConfigured: ``TETHYSDASH_SECRET_KEYS`` holds something not a key.
    """
    ring, _ = _key_ring()
    try:
        stored = json.loads(ring.decrypt(ciphertext))
        stored_identity = {name: stored[name] for name in identity.as_dict()}
        value = stored["value"]
    except Exception as error:
        # Only the error's type is kept: a JSON error carries the text it read.
        reason = f"it could not be decrypted ({type(error).__name__})"
    else:
        if stored_identity != identity.as_dict():
            reason = "it was stored for another dashboard, tile, layer, arg or plugin"
        elif not isinstance(value, str):
            reason = "what it holds is not a string"
        else:
            return SecretValue(value)
    # Raised here, outside the except clause, so no error that saw the plaintext is
    # chained to it.
    print(f"The secret for {identity} is unavailable: {reason}.")
    raise SecretUnavailable(identity)


def _values_of(values):
    """The secret values to look for, unwrapped, skipping those too short to redact."""
    if isinstance(values, (str, SecretValue)):
        values = (values,)
    for value in values or ():
        if isinstance(value, SecretValue):
            value = value.reveal()
        if isinstance(value, str) and len(value) >= MIN_REDACTED_LENGTH:
            yield value


def secret_forms(values):
    """
    Return every form in which text may carry each secret value, longest first.

    Each value is looked for as it is, URL-quoted (``quote(value, safe="")`` and
    ``quote_plus``), escaped as a JSON string (with and without ``ensure_ascii``), and
    as the inside of its Python ``repr``. A value shorter than
    :data:`MIN_REDACTED_LENGTH` is skipped.

    Args:
        values: Secret values, as strings or :class:`SecretValue` s. One value alone
            is taken as such, not as a sequence of characters.

    Returns:
        list: The distinct forms, longest first
    """
    forms = set()
    for value in _values_of(values):
        forms.update(
            (
                value,
                quote(value, safe=""),
                quote_plus(value),
                json.dumps(value)[1:-1],
                json.dumps(value, ensure_ascii=False)[1:-1],
                repr(value)[1:-1],
            )
        )
    return sorted(forms, key=lambda form: (-len(form), form))


def _as_text(text):
    return text if isinstance(text, str) else str(text)


def contains_secret(text, values):
    """
    Whether text carries any form of a secret value (see :func:`secret_forms`).

    Args:
        text: The text; None carries nothing, and anything else is read as ``str``.
        values: Secret values, as for :func:`secret_forms`

    Returns:
        bool
    """
    if text is None:
        return False
    text = _as_text(text)
    return any(form in text for form in secret_forms(values))


def redact(text, values):
    """
    Return text with every form of each secret value, and any URL password, masked.

    Every occurrence of every form of every value (see :func:`secret_forms`) is replaced
    by :data:`REDACTED`; where occurrences overlap, as when one secret holds another or
    two forms share text, one mask covers them all, so no part of either is left. Then,
    whatever the values, the password in any ``scheme://user:password@`` is masked.

    Args:
        text: The text. None is returned as is; anything else not a string is read as
            ``str``.
        values: Secret values, as for :func:`secret_forms`

    Returns:
        str or None: The redacted text
    """
    if text is None:
        return None
    text = _as_text(text)
    spans = []
    for form in secret_forms(values):
        start = text.find(form)
        while start != -1:
            spans.append((start, start + len(form)))
            start = text.find(form, start + 1)
    pieces = []
    position = 0
    for start, end in sorted(spans):
        if start < position:
            # Overlaps the mask just written: let it reach this occurrence's end.
            position = max(position, end)
            continue
        pieces.extend((text[position:start], REDACTED))
        position = end
    pieces.append(text[position:])
    return _URL_PASSWORD.sub(
        lambda match: f"{match['prefix']}{REDACTED}@", "".join(pieces)
    )
