import base64
import dataclasses
import json
import time
from urllib.parse import quote, quote_plus
from uuid import uuid4

import pytest
from cryptography.fernet import Fernet, InvalidToken
from django.core.exceptions import ImproperlyConfigured
from django.test import override_settings
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from tethysapp.tethysdash import tile_secrets
from tethysapp.tethysdash.model import TileSecret, delete_named_dashboard
from tethysapp.tethysdash.tile_secrets import (
    REDACTED,
    SecretIdentity,
    SecretUnavailable,
    SecretValue,
    contains_secret,
    decrypt,
    encrypt,
    redact,
    secret_forms,
)

SECRET = "s3cr3t-api-key"
IDENTITY = SecretIdentity(
    dashboard="11111111-1111-4111-8111-111111111111",
    tile="22222222-2222-4222-8222-222222222222",
    layer="",
    arg="api_key",
    source="fake_secret",
)
DEDICATED_KEY = Fernet.generate_key().decode()


@pytest.fixture(autouse=True)
def derived_keys_only(monkeypatch):
    """Start each test with no dedicated key and the rotation warning not yet given."""
    monkeypatch.setattr(tile_secrets, "_warned_derived_keys_only", False)
    with override_settings(
        SECRET_KEY="the-portal-secret-key",
        SECRET_KEY_FALLBACKS=[],
        TETHYSDASH_SECRET_KEYS=None,
    ):
        yield


def _token_holding(payload):
    """A token holding ``payload`` as its plaintext, under the current key ring."""
    ring, _ = tile_secrets._key_ring()
    return ring.encrypt(payload).decode()


# Encryption


def test_a_secret_round_trips():
    ciphertext = encrypt(IDENTITY, SECRET)

    value = decrypt(IDENTITY, ciphertext)

    assert isinstance(value, SecretValue)
    assert value.reveal() == SECRET


def test_ciphertext_never_holds_the_value():
    for _ in range(5):
        ciphertext = encrypt(IDENTITY, SECRET)
        assert SECRET not in ciphertext
        assert base64.urlsafe_b64encode(SECRET.encode()).decode() not in ciphertext
        assert IDENTITY.dashboard not in ciphertext


def test_a_secret_value_is_encrypted_as_its_value():
    ciphertext = encrypt(IDENTITY, SecretValue(SECRET))

    assert decrypt(IDENTITY, ciphertext).reveal() == SECRET


def test_only_a_string_is_encrypted():
    with pytest.raises(TypeError, match="must be a string") as raised:
        encrypt(IDENTITY, 123456789)

    assert "123456789" not in str(raised.value)


@pytest.mark.parametrize(
    "field,other",
    [
        ("dashboard", "33333333-3333-4333-8333-333333333333"),
        ("tile", "44444444-4444-4444-8444-444444444444"),
        ("layer", "layer-1"),
        ("arg", "token"),
        ("source", "another_plugin"),
    ],
)
def test_a_secret_read_under_another_identity_is_unavailable(field, other, capsys):
    ciphertext = encrypt(IDENTITY, SECRET)
    elsewhere = dataclasses.replace(IDENTITY, **{field: other})

    with pytest.raises(SecretUnavailable) as raised:
        decrypt(elsewhere, ciphertext)

    assert raised.value.identity == elsewhere
    logged = capsys.readouterr().out
    assert "stored for another" in logged
    assert SECRET not in logged


def test_a_dedicated_key_added_first_still_reads_derived_key_secrets():
    old = encrypt(IDENTITY, SECRET)

    with override_settings(TETHYSDASH_SECRET_KEYS=[DEDICATED_KEY]):
        assert decrypt(IDENTITY, old).reveal() == SECRET
        new = encrypt(IDENTITY, SECRET)

    # New values are encrypted with the dedicated key, which cannot open the old.
    dedicated = Fernet(DEDICATED_KEY)
    assert json.loads(dedicated.decrypt(new))["value"] == SECRET
    with pytest.raises(InvalidToken):
        dedicated.decrypt(old)


def test_a_dedicated_key_may_be_given_alone():
    with override_settings(TETHYSDASH_SECRET_KEYS=DEDICATED_KEY):
        ciphertext = encrypt(IDENTITY, SECRET)

    assert json.loads(Fernet(DEDICATED_KEY).decrypt(ciphertext))["value"] == SECRET


def test_a_rotated_secret_key_kept_as_a_fallback_still_reads_secrets():
    ciphertext = encrypt(IDENTITY, SECRET)

    with override_settings(
        SECRET_KEY="the-new-portal-secret-key",
        SECRET_KEY_FALLBACKS=["the-portal-secret-key"],
    ):
        assert decrypt(IDENTITY, ciphertext).reveal() == SECRET


def test_a_ring_without_the_original_key_makes_a_secret_unavailable(capsys):
    ciphertext = encrypt(IDENTITY, SECRET)
    capsys.readouterr()

    with override_settings(SECRET_KEY="the-new-portal-secret-key"):
        with pytest.raises(SecretUnavailable) as raised:
            decrypt(IDENTITY, ciphertext)

    assert str(raised.value) == (
        f"The secret for {IDENTITY} can't be read. Enter it again."
    )
    assert raised.value.__context__ is None
    logged = capsys.readouterr().out
    assert logged == (
        f"The secret for {IDENTITY} is unavailable: it could not be decrypted "
        "(InvalidToken).\n"
    )
    assert SECRET not in logged


def test_a_tampered_secret_is_unavailable():
    ciphertext = encrypt(IDENTITY, SECRET)
    raw = bytearray(base64.urlsafe_b64decode(ciphertext))
    raw[40] ^= 1
    tampered = base64.urlsafe_b64encode(bytes(raw)).decode()

    with pytest.raises(SecretUnavailable):
        decrypt(IDENTITY, tampered)


@pytest.mark.parametrize("ciphertext", [None, "", "not a token", 12])
def test_what_is_not_a_token_is_unavailable(ciphertext):
    with pytest.raises(SecretUnavailable):
        decrypt(IDENTITY, ciphertext)


@pytest.mark.parametrize(
    "payload",
    [
        f"not json {SECRET}".encode(),
        json.dumps([SECRET]).encode(),
        json.dumps({"value": SECRET}).encode(),
        b"\xff\xfe",
    ],
)
def test_a_token_not_holding_a_stored_secret_is_unavailable(payload, capsys):
    ciphertext = _token_holding(payload)

    with pytest.raises(SecretUnavailable) as raised:
        decrypt(IDENTITY, ciphertext)

    # A JSON error holds the text it read; none is chained to what is raised.
    assert raised.value.__context__ is None
    assert SECRET not in capsys.readouterr().out


def test_a_stored_secret_that_is_not_a_string_is_unavailable(capsys):
    payload = json.dumps({**IDENTITY.as_dict(), "value": ["not", "a", "string"]})
    ciphertext = _token_holding(payload.encode())

    with pytest.raises(SecretUnavailable):
        decrypt(IDENTITY, ciphertext)

    assert "not a string" in capsys.readouterr().out


def test_encrypting_with_derived_keys_only_warns_once(capsys):
    encrypt(IDENTITY, SECRET)
    encrypt(IDENTITY, SECRET)

    logged = capsys.readouterr().out
    assert logged.count("Warning:") == 1
    assert "SECRET_KEY changes" in logged
    assert "unrecoverable" in logged
    assert "TETHYSDASH_SECRET_KEYS" in logged


def test_encrypting_with_a_dedicated_key_does_not_warn(capsys):
    with override_settings(TETHYSDASH_SECRET_KEYS=[DEDICATED_KEY]):
        encrypt(IDENTITY, SECRET)

    assert capsys.readouterr().out == ""


@pytest.mark.parametrize("bad_key", ["not-a-fernet-key", 42])
def test_a_dedicated_key_that_is_not_a_key_is_a_configuration_error(bad_key):
    ciphertext = encrypt(IDENTITY, SECRET)

    with override_settings(TETHYSDASH_SECRET_KEYS=[DEDICATED_KEY, bad_key]):
        for attempt in (
            lambda: encrypt(IDENTITY, SECRET),
            lambda: decrypt(IDENTITY, ciphertext),
        ):
            with pytest.raises(ImproperlyConfigured) as raised:
                attempt()
            assert "Entry 1 of TETHYSDASH_SECRET_KEYS" in str(raised.value)
            assert str(bad_key) not in str(raised.value)


def test_an_identity_keeps_strings_and_an_empty_layer():
    dashboard = uuid4()
    identity = SecretIdentity(dashboard, "tile", None, "api_key", "fake_secret")

    assert identity.as_dict() == {
        "dashboard": str(dashboard),
        "tile": "tile",
        "layer": "",
        "arg": "api_key",
        "source": "fake_secret",
    }
    assert identity == SecretIdentity(
        str(dashboard), "tile", "", "api_key", "fake_secret"
    )
    assert str(identity) == (
        f"dashboard {dashboard} tile tile arg 'api_key' (plugin fake_secret)"
    )
    assert str(dataclasses.replace(identity, layer="layer-1")) == (
        f"dashboard {dashboard} tile tile layer layer-1 arg 'api_key' "
        "(plugin fake_secret)"
    )


# The value wrapper


def test_a_secret_value_never_shows_itself():
    value = SecretValue(SECRET)

    for shown in (
        repr(value),
        str(value),
        f"{value}",
        "%s %r" % (value, value),
        repr([value]),
        repr({"api_key": value}),
    ):
        assert SECRET not in shown
        assert REDACTED in shown
    assert value.reveal() == SECRET
    with pytest.raises(TypeError):
        json.dumps({"api_key": value})


# Redaction

# A value with a space, quotes, a slash, a backslash and a non-ASCII letter, so that
# every form of it differs from the others.
AWKWARD = "p@ss w/o\\'\"é"


def test_every_form_of_a_secret_is_redacted():
    forms = {
        "raw": AWKWARD,
        "quote": quote(AWKWARD, safe=""),
        "quote_plus": quote_plus(AWKWARD),
        "json": json.dumps(AWKWARD)[1:-1],
        "json, unicode": json.dumps(AWKWARD, ensure_ascii=False)[1:-1],
        "repr": repr(AWKWARD)[1:-1],
    }
    assert len(set(forms.values())) == len(forms)
    assert set(secret_forms([AWKWARD])) == set(forms.values())

    for name, form in forms.items():
        text = f"Failed with {form}."
        assert redact(text, [AWKWARD]) == f"Failed with {REDACTED}.", name
        assert contains_secret(text, [AWKWARD]), name


def test_redaction_masks_each_occurrence_of_each_secret():
    text = f"key={SECRET}&token=other-token&again={SECRET}"

    assert redact(text, [SECRET, "other-token"]) == (
        f"key={REDACTED}&token={REDACTED}&again={REDACTED}"
    )


def test_a_url_password_is_masked_whatever_the_secrets():
    text = (
        "Could not connect to postgres://reader:hunter22@db.example:5432/data, "
        "redis://:token@cache, 'https://user:p@ss@host/x' or http://host:8080/path"
    )

    assert redact(text, []) == (
        f"Could not connect to postgres://reader:{REDACTED}@db.example:5432/data, "
        f"redis://:{REDACTED}@cache, 'https://user:{REDACTED}@host/x' or "
        "http://host:8080/path"
    )


def test_a_url_password_is_masked_whatever_runs_into_the_scheme():
    long_scheme = "sqlalchemy.url.postgresql+psycopg2.driver"
    text = f"404-https://u:pw@h x{long_scheme}://u:pw@h 1://u:pw@h"

    assert redact(text, []) == (
        f"404-https://u:{REDACTED}@h x{long_scheme}://u:{REDACTED}@h "
        f"1://u:{REDACTED}@h"
    )


# Text a pattern that backtracks would take far longer than linear time over: the old
# URL password pattern took about 6 s over the first 80,000 characters of most.
SLOW_TEXTS = {
    "letters": "a" * 2_000_000,
    "scheme characters": "a." * 1_000_000,
    "url fragments": "x://y" * 400_000,
    "url fragments with a colon": "x://y:" * 300_000,
    "a long scheme and user": "a" * 1_000_000 + "://" + "b" * 1_000_000,
    "a long password with no at sign": "a://u:" + "p" * 2_000_000,
}


@pytest.mark.parametrize("text", SLOW_TEXTS.values(), ids=SLOW_TEXTS.keys())
def test_redaction_takes_linear_time(text):
    start = time.perf_counter()
    redact(text, [SECRET])
    contains_secret(text, [SECRET])

    assert time.perf_counter() - start < 1


def test_a_url_password_that_is_a_secret_is_masked_once():
    text = f"postgres://reader:{SECRET}@db"

    assert redact(text, [SECRET]) == f"postgres://reader:{REDACTED}@db"


def test_a_secret_under_four_characters_is_not_redacted():
    assert secret_forms(["abc", "", None, 1234]) == []
    assert redact("abc abcd", ["abc"]) == "abc abcd"
    assert redact("abc abcd", ["abcd"]) == f"abc {REDACTED}"
    assert not contains_secret("abc", ["abc"])


def test_overlapping_secrets_are_redacted_longest_first():
    # One secret holding another: masking the shorter first would leave "gh".
    assert secret_forms(["abcdef", "abcdefgh"]) == ["abcdefgh", "abcdef"]
    assert redact("xxabcdefghxx", ["abcdef", "abcdefgh"]) == f"xx{REDACTED}xx"
    # Two secrets sharing text: no part of either is left.
    assert redact("x abcdefgh x", ["abcdef", "cdefgh"]) == f"x {REDACTED} x"
    # Back to back, each gets its own mask.
    assert redact("abcdwxyz", ["abcd", "wxyz"]) == f"{REDACTED}{REDACTED}"


def test_a_secret_inside_the_mask_is_not_masked_again():
    assert redact("dact", ["dact"]) == REDACTED


def test_redaction_takes_one_secret_or_wrapped_secrets():
    text = f"key {SECRET}"

    assert redact(text, SECRET) == f"key {REDACTED}"
    assert redact(text, SecretValue(SECRET)) == f"key {REDACTED}"
    assert redact(text, [SecretValue(SECRET)]) == f"key {REDACTED}"
    assert contains_secret(text, SecretValue(SECRET))


def test_redaction_without_secrets_changes_nothing_else():
    assert redact("nothing secret here", None) == "nothing secret here"
    assert redact("", [SECRET]) == ""
    assert not contains_secret("nothing secret here", None)


def test_redaction_of_what_is_not_a_string():
    assert redact(None, [SECRET]) is None
    assert not contains_secret(None, [SECRET])
    assert redact(ValueError(f"bad key {SECRET}"), [SECRET]) == f"bad key {REDACTED}"
    assert redact({"key": SECRET}, [SECRET]) == f"{{'key': '{REDACTED}'}}"
    assert contains_secret({"key": SECRET}, [SECRET])
    assert redact(12345, ["12345"]) == REDACTED


# The table


@pytest.mark.django_db
def test_the_tile_secrets_table_is_created(db_session):
    inspector = inspect(db_session.bind)

    columns = {
        column["name"]: column for column in inspector.get_columns("tile_secrets")
    }
    assert set(columns) == {
        "id",
        "dashboard_id",
        "tile_uuid",
        "layer_id",
        "arg_name",
        "plugin_source",
        "ciphertext",
        "updated_by",
        "updated_at",
    }
    assert not any(columns[name]["nullable"] for name in set(columns) - {"id"})
    (foreign_key,) = inspector.get_foreign_keys("tile_secrets")
    assert foreign_key["referred_table"] == "dashboards"
    assert foreign_key["options"].get("ondelete") == "CASCADE"
    assert {
        "name": "_tile_secret_path",
        "column_names": ["dashboard_id", "tile_uuid", "layer_id", "arg_name"],
    }.items() <= inspector.get_unique_constraints("tile_secrets")[0].items()


def _secret_row(dashboard, arg="api_key", **fields):
    return TileSecret(
        dashboard_id=dashboard.id,
        tile_uuid=IDENTITY.tile,
        arg_name=arg,
        plugin_source="fake_secret",
        ciphertext=encrypt(IDENTITY, SECRET),
        updated_by="editor",
        **fields,
    )


@pytest.mark.django_db
def test_a_tile_level_secret_has_an_empty_layer_and_a_time(db_session, dashboard):
    db_session.add(_secret_row(dashboard))
    db_session.commit()

    (row,) = db_session.query(TileSecret).all()
    assert row.layer_id == ""
    assert row.updated_at is not None
    assert row.dashboard.id == dashboard.id


@pytest.mark.django_db
def test_one_secret_per_dashboard_tile_layer_and_arg(db_session, dashboard):
    db_session.add_all(
        [
            _secret_row(dashboard),
            _secret_row(dashboard, layer_id="layer-1"),
            _secret_row(dashboard, arg="token"),
        ]
    )
    db_session.commit()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(_secret_row(dashboard))


@pytest.mark.django_db
def test_deleting_a_dashboard_deletes_its_secrets(
    db_session, dashboard, mock_app_get_ps_db, test_owner_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    db_session.add_all(
        [_secret_row(dashboard), _secret_row(dashboard, layer_id="layer-1")]
    )
    db_session.commit()

    delete_named_dashboard(test_owner_user, dashboard.id)

    assert db_session.query(TileSecret).count() == 0
