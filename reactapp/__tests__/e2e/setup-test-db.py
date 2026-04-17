#!/usr/bin/env python
"""One-time setup: configure SQLite persistent store for E2E tests.

Run this ONCE before running Playwright tests:
    DJANGO_SETTINGS_MODULE=tethys_portal.settings python reactapp/__tests__/e2e/setup-test-db.py

What it does:
1. Creates a SQLitePersistentStoreService pointing to ~/.tethys/e2e-test/
2. Assigns it to TethysDash's primary_db persistent store setting
3. Runs syncstores to create and migrate the SQLite database (Alembic)

After this, Playwright tests can write fixtures into the SQLite file via better-sqlite3.
"""

import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tethys_portal.settings")
django.setup()

from pathlib import Path
from tethys_services.models import SQLitePersistentStoreService
from tethys_apps.models import TethysApp, PersistentStoreDatabaseSetting


DB_DIR = os.path.expanduser("~/.tethys/e2e-test")
SERVICE_NAME = "tethysdash_e2e_sqlite"


def main():
    Path(DB_DIR).mkdir(parents=True, exist_ok=True)
    print(f"DB directory: {DB_DIR}")

    # Create or get the SQLite service
    svc, created = SQLitePersistentStoreService.objects.get_or_create(
        name=SERVICE_NAME,
        defaults={"dir_path": DB_DIR},
    )
    if not created:
        svc.dir_path = DB_DIR
        svc.save()
        print(f"Updated existing service: {SERVICE_NAME}")
    else:
        print(f"Created service: {SERVICE_NAME}")

    # Find TethysDash app and its primary_db setting
    try:
        app = TethysApp.objects.get(package="tethysdash")
    except TethysApp.DoesNotExist:
        print("ERROR: TethysDash app not found. Run 'tethys install -d' first.")
        sys.exit(1)

    try:
        ps_setting = PersistentStoreDatabaseSetting.objects.get(
            tethys_app=app, name="primary_db"
        )
    except PersistentStoreDatabaseSetting.DoesNotExist:
        print("ERROR: primary_db setting not found for TethysDash.")
        sys.exit(1)

    # Assign the SQLite service via GenericForeignKey property
    ps_setting.persistent_store_service = svc
    ps_setting.save()
    print(f"Assigned {SERVICE_NAME} to TethysDash primary_db")

    # Run syncstores to create and migrate the database
    from django.core.management import call_command
    print("Running syncstores...")
    call_command("syncstores", "tethysdash", verbosity=1)
    print("Done! SQLite database ready for E2E tests.")

    # Print the DB path for reference
    db_path = os.path.join(DB_DIR, "tethysdash_primary_db.sqlite")
    print(f"\nDB path: {db_path}")
    print("Set E2E_DB_PATH environment variable if the path differs.")


if __name__ == "__main__":
    main()
