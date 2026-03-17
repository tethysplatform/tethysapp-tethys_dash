# TethysDash

This app was created using an experimental Tethys + React app scaffold. It uses React for the frontend of the app and Tethys as the backend. For more detailed information, check the [official TethysDash documentation](https://tethysdashdocs.readthedocs.io/en/latest/index.html)

## Development Installation

You need to install both the Tethys dependencies and the node dependencies:

1. Open Terminal and activate tethys env

```
conda activate tethys
```

2. Clone the Repo

```
git clone https://github.com/tethysplatform/tethysapp-tethys_dash
```

3. Install the app in Tethys Platform

```
cd tethysapp-tethys_dash/
tethys install -d
```

4. Create Persistence Store (if not done already) (update connection string as needed)

```
## Command Line Interface (CLI)

After installing tethysdash, you can use the CLI tool:

```

tethysdash

```

This will run the CLI entry point defined in the package. You can add arguments as needed:

```

tethysdash <arguments>

```

For example:

```

tethysdash --help

```

### Setup Command

To run Tethys portal and database setup commands, use:

```

tethysdash setup

```

This will execute:

- `tethys gen portal_config`
- `tethys db configure`

You must have the `tethys` CLI available in your environment.
tethys services create persistent -n primary_db -c postgres:mysecretpassword@localhost:5432
```

5. Connect Persistence Store to TethysDash

```
tethys link persistent:primary_db tethysdash:ps_database:primary_db
```

6. Setup Environment Variables (not necessary unless connection values are different)

```
export POSTGRES_PASSWORD=mysecretpassword
export TETHYS_DB_HOST=localhost
export TETHYSDASH_DB_NAME=tethysdash_primary_db
export TETHYS_DB_PORT=5432
```

7. Setup TethysDash DB Tables

```
tethys syncstores tethysdash
```

8. Install Plugin Examples (not necessary but recommended)

```
cd ..
git clone https://github.com/FIRO-Tethys/tethysdash_examples
cd tethysdash_examples
pip install -e .
```

## Development

The webpack dev server is configured to proxy the Tethys development server (see `webpack.config.js`). The app endpoint will be handled by the webpack development server and all other endpoints will be handled by the Tethys (Django) development server. As such, you will need to start both in separate terminals.

1. Install the node and dependencies

```
cd tethysapp-tethysdash
npm install --dev
```

2. Start Tethys development server

```
tethys manage start
```

3. Start webpack development server (in separate terminal)

```
npm start
```

## Build

Webpack is configured to bundle and build the React app into the `tethysapp/<app_package>/public/frontend` directory. Before building a Python distribution for release, you should build using this command:

```
npm run build
```

## Test

Use the following commands to lint and test the React portion of the app.

```
npm run lint
npm run test
```

The linting capability is powered by [eslint](https://eslint.org/) and a number of plugins for React. The testing capabilities include [jest](https://jestjs.io/), [jsdom](https://github.com/jsdom/jsdom#readme), [testing-framework](https://testing-library.com/), [user-event](https://testing-library.com/docs/user-event/intro/), and a few other JavaScript testing utilties to make it easy to test the frontend of the React-Tethys app.
