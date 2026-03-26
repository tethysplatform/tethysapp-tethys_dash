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