const path = require("path");
const webpack = require("webpack");
const Dotenv = require("dotenv-webpack");
const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const { WebpackManifestPlugin } = require("webpack-manifest-plugin");

module.exports = (env, argv) => {
  const dotEnvPath = `./reactapp/config/${argv.mode}.env`;
  require("dotenv").config({ path: dotEnvPath });

  const isProd = argv.mode === "production";

  console.log(`Building in ${argv.mode} mode...`);
  console.log(`=> Using .env config at "${dotEnvPath}"`);
  return {
    entry: ["./reactapp"],
    output: {
      path: path.resolve(
        __dirname,
        "../../tethysapp/tethysdash/public/frontend",
      ),
      filename: isProd ? "[name].[contenthash].js" : "[name].js",
      chunkFilename: isProd ? "[name].[contenthash].js" : "[name].js",
      // "auto" derives the public path from the entry script's URL at runtime,
      // so one build serves any static prefix (same-origin). A cross-origin/CDN
      // base is handled later by a runtime __webpack_public_path__ override.
      publicPath: "auto",
      clean: isProd ? { keep: /\.gitkeep$/ } : false,
    },
    resolve: {
      modules: [
        path.resolve(__dirname, "../"),
        path.resolve(__dirname, "../../node_modules"),
      ],
    },
    plugins: [
      new Dotenv({
        path: dotEnvPath,
      }),
      new ModuleFederationPlugin({
        name: "host_react_module",
        filename: "remoteEntry.js",
        remotes: {},
        shared: {
          react: {
            requiredVersion: false,
            singleton: true,
            eager: true,
          },
        },
      }),
      ...(isProd
        ? [
            new WebpackManifestPlugin({
              fileName: "manifest.json",
              publicPath: "",
            }),
          ]
        : []),
    ],
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: [
            {
              loader: "babel-loader",
            },
          ],
        },
        {
          test: /\.css$/,
          // exclude: /node_modules/,
          use: [
            {
              loader: "style-loader",
            },
            {
              loader: "css-loader",
            },
          ],
        },
        {
          test: /\.(scss|sass)$/,
          exclude: /node_modules/,
          use: [
            {
              loader: "style-loader",
            },
            {
              loader: "css-loader",
            },
            {
              loader: "sass-loader",
            },
          ],
        },
        {
          test: /\.(jpe?g|png|gif|svg|mp4|mp3)$/,
          use: [
            {
              loader: "file-loader",
              options: {
                outputPath: "",
              },
            },
          ],
        },
      ],
    },
    optimization: {
      minimize: true,
    },
    devServer: {
      proxy: [
        {
          context: ["!/static/tethysdash/frontend/**"],
          target: "http://localhost:8000", // points to django dev server
          changeOrigin: true,
          // Lets Django detect that this request was proxied through
          // webpack-dev-server so it renders the unhashed main.js URL
          // (served from memory) instead of the on-disk hashed bundle.
          headers: { "X-Webpack-Dev-Server": "1" },
        },
      ],
      open: true,
    },
  };
};
