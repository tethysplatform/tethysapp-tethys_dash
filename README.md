# AquaInsight

This app was created using an experimental Tethys + React app scaffold. It uses React for the frontend of the app and Tethys as the backend.

## Development Installation

You need to install both the Tethys dependencies and the node dependencies:

1. Install the app in Tethys Platform

```
conda activate tethys
cd tethysapp-aquainsight
tethys install -d
```

2. Install the node and dependencies

```
cd tethysapp-aquainsight
npm install --dev
```

## Development

The webpack dev server is configured to proxy the Tethys development server (see `webpack.config.js`). The app endpoint will be handled by the webpack development server and all other endpoints will be handled by the Tethys (Django) development server. As such, you will need to start both in separate terminals.

1. Start Tethys development server

```
tethys manage start
```

2. Start webpack development server (in separate terminal)

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

## Acknowledgements

This implementation is based on the excellent work done by @Jitensid that can be found on GitHub here: [Jitensid/django-webpack-dev-server](https://github.com/Jitensid/django-webpack-dev-server).

Some resources and source code is also derived from projects generated using [Create React App](https://create-react-app.dev/).