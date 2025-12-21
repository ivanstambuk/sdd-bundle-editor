const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

/** @type {import('webpack').Configuration} */
module.exports = {
  mode: 'development',
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        // CSS Modules - for .module.css files
        test: /\.module\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[name]__[local]--[hash:base64:5]',
                namedExport: false, // Use default export with class names object
              },
            },
          },
        ],
      },
      {
        // Regular CSS - for non-module .css files
        test: /\.css$/,
        exclude: /\.module\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'public/index.html',
    }),
    new (require('webpack').DefinePlugin)({
      'process.env.SDD_SAMPLE_BUNDLE_PATH': JSON.stringify(process.env.SDD_SAMPLE_BUNDLE_PATH),
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    historyApiFallback: true,
    port: 5173,
    proxy: [
      {
        // MCP server and API endpoints
        context: ['/mcp', '/api'],
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    ],
  },
};
