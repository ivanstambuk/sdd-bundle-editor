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
        test: /\.css$/,
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
        // MCP server (primary for MCP-first architecture)
        context: ['/mcp'],
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      {
        // Legacy HTTP server (fallback)
        context: ['/bundle', '/bundle/validate', '/bundle/save', '/health'],
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    ],
  },
};
