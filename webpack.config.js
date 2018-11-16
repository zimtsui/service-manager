const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const webpackNodeExternals = require('webpack-node-externals');

module.exports = {
    mode: 'development',
    target: 'node',
    devtool: 'source-map',
    entry: './src/index.js',
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [{ test: /\.js$/, use: 'babel-loader' }],
    },
    plugins: [
        new CleanWebpackPlugin(['dist']),
    ],
    externals: [webpackNodeExternals()],
};
