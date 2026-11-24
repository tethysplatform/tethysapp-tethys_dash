.. _installation:

Installation and Setup
======================

TethysDash uses `Tethys Platform <https://www.tethysplatform.org/>`_ as the backend and React for the frontend.

Quick Installation
------------------

1. Create and activate a Python virtual environment (optional but recommended):

.. code-block:: bash

   python3 -m venv test_env
   source test_env/bin/activate

2. Install TethysDash:

.. code-block:: bash

   pip install tethysdash

3. Setup Tethys and TethysDash databases/services:

.. code-block:: bash

   tethysdash setup

4. Start Tethys Portal:

.. code-block:: bash

   tethysdash start

Development Installation
------------------------

Install both Python/Tethys dependencies and Node dependencies for full development.

1. Create and activate a Python virtual environment (optional but recommended):

.. code-block:: bash

   python3 -m venv test_env
   source test_env/bin/activate

2. Clone the repository:

.. code-block:: bash

   git clone https://github.com/tethysplatform/tethysapp-tethys_dash
   cd tethysapp-tethys_dash/

3. Install the app in editable mode:

.. code-block:: bash

   pip install -e .

4. Setup Tethys and TethysDash databases/services:

.. code-block:: bash

   tethysdash setup

5. (Optional) Install plugin examples:

.. code-block:: bash

   cd ..
   git clone https://github.com/FIRO-Tethys/tethysdash_examples
   cd tethysdash_examples
   pip install -e .

6. Start Tethys Portal:

.. code-block:: bash

   tethysdash start

Frontend Development
--------------------

The webpack dev server proxies the Tethys development server. Run both in separate terminals.

1. Install Node dependencies:

.. code-block:: bash

   cd tethysapp-tethys_dash/
   npm install --dev

2. Start Tethys development server:

.. code-block:: bash

   tethys manage start

3. Start webpack development server (separate terminal):

.. code-block:: bash

   npm start

Frontend Build
--------------

Build frontend assets before creating a Python distribution:

.. code-block:: bash

   npm run build

Frontend Test
-------------

Lint and test the React frontend:

.. code-block:: bash

   npm run lint
   npm run test

Testing uses tools such as `eslint <https://eslint.org/>`_, `jest <https://jestjs.io/>`_, `jsdom <https://github.com/jsdom/jsdom#readme>`_, and `Testing Library <https://testing-library.com/>`_.

Websocket Configuration
-----------------------

Some visualizations (for example, Live Chat and Progress Updating) require WebSocket support.  
To enable this, configure a Redis server and update the Tethys Portal configuration file accordingly.

For setup details, see the `Tethys Platform Django Channels documentation <https://docs.tethysplatform.org/en/stable/installation/production/manual/configuration/advanced/django_channels_layer.html>`_.

Upgrading
---------

After installing a new version of TethysDash on an existing portal, update the app's database before starting the portal:

.. code-block:: bash

   tethys syncstores tethysdash

``tethys db sync`` migrates only the portal's own database, not the app's. Among other changes, ``syncstores`` creates the table that holds plugin secrets (see `Plugin Secrets`_).

Plugin Secrets
--------------

Plugins can take secrets, such as API keys and passwords, which dashboard editors enter in a dashboard item's settings. TethysDash stores each one encrypted in the app's database and never sends it back to a browser.

Encryption Keys
^^^^^^^^^^^^^^^

Give TethysDash keys of its own with the ``TETHYSDASH_SECRET_KEYS`` setting, a list of Fernet keys, in the ``settings`` section of ``portal_config.yml``. Generate a key with:

.. code-block:: bash

   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

.. code-block:: yaml

   settings:
     TETHYSDASH_SECRET_KEYS:
       - <generated key>

The first key in the list encrypts every secret saved from then on, and any key in the list can read one. To rotate, put the new key first and keep the old keys after it. Secrets saved under an old key stay readable, and each moves to the new key when an editor enters it again. Remove an old key only once every secret saved under it has been entered again. Guard the keys as you guard ``SECRET_KEY``: a secret whose key is lost cannot be recovered.

Without ``TETHYSDASH_SECRET_KEYS``, secrets are encrypted with a key derived from the portal's ``SECRET_KEY``, and the portal logs a warning saying so the first time it saves one. Adding ``TETHYSDASH_SECRET_KEYS`` later keeps those secrets readable, as long as ``SECRET_KEY`` stays the same.

.. warning::

   If ``portal_config.yml`` sets no ``SECRET_KEY``, Tethys generates a random one each time a process starts. Without ``TETHYSDASH_SECRET_KEYS``, stored secrets then cannot be read after a restart, nor by any worker process but the one that saved them. Set ``TETHYSDASH_SECRET_KEYS``, or a fixed ``SECRET_KEY``.

Changing ``SECRET_KEY`` makes every secret saved without a ``TETHYSDASH_SECRET_KEYS`` key unreadable, unless the old value stays in ``SECRET_KEY_FALLBACKS``:

.. code-block:: yaml

   settings:
     SECRET_KEY: <new secret key>
     SECRET_KEY_FALLBACKS:
       - <old secret key>

A secret that cannot be read counts as missing: editors are asked to enter it again, and viewers are told the dashboard item is not set up yet.

Error Reports
^^^^^^^^^^^^^

Secrets travel to the server in request bodies: when an editor saves a dashboard, and in the editor's data requests until then. TethysDash keeps them out of its own error messages and logs. Keep them out of everything else:

- Keep ``DEBUG`` off in production. Tethys turns it on when ``portal_config.yml`` does not set it, so set ``DEBUG: false``.
- Configure error reporting services not to capture request bodies. For Sentry, set ``max_request_body_size="never"``.

Request Size
^^^^^^^^^^^^

Each dashboard item sends its settings to the server in the body of its data request: all of them for someone who can edit the dashboard, and for everyone else the values its variable inputs and dates fill in. Django refuses a body larger than ``DATA_UPLOAD_MAX_MEMORY_SIZE``, 2.5 MB by default, and the dashboard item says the values sent are too large. Set nginx's ``client_max_body_size`` at or above that limit, so that Django's limit is the one that applies. The configuration ``tethys gen nginx`` writes uses 75M, but nginx's own default is 1 MB. If you raise ``DATA_UPLOAD_MAX_MEMORY_SIZE``, raise ``client_max_body_size`` with it.

Sign-In and Embedding
^^^^^^^^^^^^^^^^^^^^^

TethysDash sends the portal's CSRF token with every POST request, data requests included. On a portal that sets ``CSRF_COOKIE_HTTPONLY`` or ``CSRF_USE_SESSIONS``, a tab that was open when its user signed in from another tab keeps the old token, and its requests fail until the tab is reloaded.

Tethys sends ``X-Frame-Options: DENY`` by default, so dashboards cannot be shown in an iframe. Loosening that to embed dashboards in another site does not work: browsers do not send the portal's CSRF cookie from inside a cross-site iframe, so the dashboard's data requests fail.