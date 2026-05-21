const path = require("path");
const webpack = require("webpack");
const Dotenv = require("dotenv-webpack");
const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const { WebpackManifestPlugin } = require("webpack-manifest-plugin");

module.exports = (env, argv) => {
  const dotEnvPath = `./reactapp/config/${argv.mode}.env`;
  require("dotenv").config({ path: dotEnvPath });
  if (process.env.TETHYS_PREFIX_URL) {
    tethys_prefix_url = `/${process.env.TETHYS_PREFIX_URL}`;
  } else {
    tethys_prefix_url = "";
  }

  const isProd = argv.mode === "production";

  console.log(`Building in ${argv.mode} mode...`);
  console.log(`=> Using .env config at "${dotEnvPath}"`);
  console.log(`=> Using prefix "${tethys_prefix_url}"`);
  return {
    entry: ["./reactapp"],
    output: {
      path: path.resolve(
        __dirname,
        "../../tethysapp/tethysdash/public/frontend"
      ),
      filename: isProd ? "[name].[contenthash].js" : "[name].js",
      chunkFilename: isProd ? "[name].[contenthash].js" : "[name].js",
      publicPath: `${tethys_prefix_url}/static/tethysdash/frontend/`,
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
    ignoreWarnings: [
      // @huggingface/transformers v4.1.0–4.2.0 (latest) emits
      // `Object(import.meta).url` at transformers.web.js:89, which webpack's
      // ESM parser rejects — only property access or destructuring of
      // `import.meta` is statically analyzable. The offending line is guarded
      // by `if (RUNNING_LOCALLY)` (Node-only), so it is unreachable in the
      // browser bundle. Remove this entry if upstream fixes the pattern.
      {
        module: /@huggingface\/transformers\/dist\/transformers\.web\.js/,
        message: /Critical dependency: Accessing import\.meta directly/,
      },
    ],
    optimization: {
      minimize: true,
    },
    devServer: {
      proxy: {
        "!/static/tethysdash/frontend/**": {
          target: "http://localhost:8000", // points to django dev server
          changeOrigin: true,
        },
      },
      open: true,
    },
  };
};
