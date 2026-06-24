# TethysDash

This app was created using an experimental Tethys + React app scaffold. It uses React for the frontend of the app and Tethys as the backend. For more detailed information, check the [official TethysDash documentation](https://tethysdash.readthedocs.io/en/latest/)

## Quick Installation

1. If creating a new python environment, create and activate it

```
    python3 -m venv test_env
    source test_env/bin/activate
```

2. Install TethysDash

```
    pip install tethysdash
```

3. Setup Tethys and TethysDash Databases and Services

```
    tethysdash setup
```

4. Start Tethys Portal

```
    tethysdash start
```

## Development Installation

You need to install both the Tethys dependencies and the node dependencies:

1. If creating a new python environment, create and activate it

```
    python3 -m venv test_env
    source test_env/bin/activate
```

2. Clone the Repo

```
git clone https://github.com/tethysplatform/tethysapp-tethys_dash
```

3. Install the app in Tethys Platform

```
cd tethysapp-tethys_dash/
pip install -e .
```

4. Setup Tethys and TethysDash Databases and Services

```
    tethysdash setup
```

5. Install Plugin Examples (not necessary but recommended)

```
cd ..
git clone https://github.com/FIRO-Tethys/tethysdash_examples
cd tethysdash_examples
pip install -e .
```

6. Start Tethys Portal

```
    tethysdash start
```

## Frontend Development

The webpack dev server is configured to proxy the Tethys development server (see `webpack.config.js`). The app endpoint will be handled by the webpack development server and all other endpoints will be handled by the Tethys (Django) development server. As such, you will need to start both in separate terminals.

1. Install the node and dependencies

```
cd tethysapp-tethys_dash/
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

## Frontend Build

Webpack is configured to bundle and build the React app into the `tethysapp/<app_package>/public/frontend` directory. Before building a Python distribution for release, you should build using this command:

```
npm run build
```

> **Note:** The compiled frontend in `tethysapp/tethysdash/public/frontend/` is **not committed** to the repository — CI builds it when publishing a release. When running the app from a clone, you must build it yourself first: either run `npm run build` before `tethysdash start`, or use the webpack dev server (`npm start`) which serves the bundle from memory. Without one of these, Django has no frontend bundle to serve.

### Serving the built frontend in development

The production build emits content-hashed filenames (e.g. `main.<hash>.js`) and a `manifest.json` mapping logical names to the hashed files. Mode detection is automatic:

- **Hit Django directly** (e.g. `localhost:8000/apps/tethysdash/`) → the page loads the hashed bundle named in `manifest.json`, served straight from the app's `public/frontend/` directory.
- **Hit the webpack dev server** (e.g. `localhost:8080`) → the dev server proxies the page request to Django with an `X-Webpack-Dev-Server` header. Django detects it and renders the unhashed `main.js` URL, which the dev server serves from memory.

No environment variable or `DEBUG` toggle is required to switch between the two.

## Frontend Test

Use the following commands to lint and test the React portion of the app.

```
npm run lint
npm run test
```

The linting capability is powered by [eslint](https://eslint.org/) and a number of plugins for React. The testing capabilities include [jest](https://jestjs.io/), [jsdom](https://github.com/jsdom/jsdom#readme), [testing-framework](https://testing-library.com/), [user-event](https://testing-library.com/docs/user-event/intro/), and a few other JavaScript testing utilties to make it easy to test the frontend of the React-Tethys app.

## Backend Lint and Test

The Python backend is linted with [ruff](https://docs.astral.sh/ruff/) and tested with `pytest`:

```
ruff check .
python -m pytest --reuse-db
```

## Continuous Integration and Releasing

CI runs in GitHub Actions (`.github/workflows/`):

- **On every pull request to `main`** (`ci.yml`): the frontend (eslint, prettier, jest) and backend (ruff, pytest) suites must pass.
- **On a version tag** (`release.yml`): the suite re-runs, then the package is built and published to PyPI.

The package version is **dynamic** — it is derived from the git tag at build time by [setuptools_scm](https://setuptools-scm.readthedocs.io/), not stored in `pyproject.toml`. To cut a release, push a `v`-prefixed semantic-version tag from `main`:

```
git tag v0.19.17
git push origin v0.19.17
```

This triggers the release workflow, which publishes `tethysdash 0.19.17` to PyPI (via [PyPI Trusted Publishing](https://docs.pypi.org/trusted-publishers/)) and creates a GitHub Release. Tags must use the `v` prefix for the workflow to fire.
