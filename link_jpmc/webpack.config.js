'use strict';

var path = require('path');
var shell = require('shelljs');
var MiniCssExtractPlugin = require('mini-css-extract-plugin');

var packageJson = require('./package.json');
var basePath = path.resolve(__dirname, packageJson.paths.base);
var CARTRIDGES = ['int_jpmc_sfra', 'int_jpmc_core', 'bm_jpmc'];
var outputBase = path.resolve(__dirname, 'cartridges/int_jpmc_sfra/cartridge/static');

var getCartridgePaths = function (cartridgeName) {
    return {
        clientBase: path.resolve(__dirname, 'cartridges/' + cartridgeName + '/cartridge/client'),
        staticBase: path.resolve(__dirname, 'cartridges/' + cartridgeName + '/cartridge/static')
    };
};

var createJsEntries = function (cartridgeName) {
    var paths = getCartridgePaths(cartridgeName);
    var clientBase = paths.clientBase;
    var staticBase = paths.staticBase;
    var result = {};

    if (!shell.test('-d', clientBase)) {
        return result;
    }
    shell.ls(path.join(clientBase, '**/js/**/*.js')).forEach(function (filePath) {
        var key = path.relative(clientBase, filePath).slice(0, -3);
        result[path.relative(outputBase, path.join(staticBase, key))] = filePath;
    });
    return result;
};

var createScssEntries = function (cartridgeName) {
    var paths = getCartridgePaths(cartridgeName);
    var clientBase = paths.clientBase;
    var staticBase = paths.staticBase;
    var result = {};

    if (!shell.test('-d', clientBase)) {
        return result;
    }
    shell.ls(path.join(clientBase, '**/scss/*.scss')).forEach(function (filePath) {
        if (path.basename(filePath).charAt(0) === '_') { return; }
        var key = path.relative(clientBase, filePath)
            .slice(0, -5)
            .replace(path.sep + 'scss' + path.sep, path.sep + 'css' + path.sep);
        result[path.relative(outputBase, path.join(staticBase, key))] = filePath;
    });
    return result;
};

var mergeEntries = function (createEntriesFn) {
    return CARTRIDGES.reduce(function (acc, name) {
        return Object.assign(acc, createEntriesFn(name));
    }, {});
};

var jsEntries = mergeEntries(createJsEntries);
var scssEntries = mergeEntries(createScssEntries);

var baseAlias = function (type) {
    return path.join(basePath, 'cartridge/client/default/' + type);
};

module.exports = [
    {
        name: 'js',
        mode: 'production',
        devtool: false,
        entry: jsEntries,
        output: {
            path: outputBase,
            filename: '[name].js'
        },
        module: {
            rules: [{
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: { presets: ['@babel/env'], cacheDirectory: true }
                }
            }]
        },
        resolve: {
            extensions: ['.js'],
            alias: {
                base: baseAlias('js'),
                'base/components/cleave': path.resolve(__dirname, 'cartridges/int_jpmc_sfra/cartridge/client/default/js/components/cleave.js')
            }
        }
    },

    {
        name: 'scss',
        mode: 'production',
        entry: scssEntries,
        output: {
            path: outputBase
        },
        plugins: [
            new MiniCssExtractPlugin({ filename: '[name].css' })
        ],
        module: {
            rules: [{
                test: /\.scss$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    { loader: 'css-loader', options: { url: false } },
                    { loader: 'sass-loader', options: { api: 'modern' } }
                ]
            }]
        },
        resolve: {
            alias: {
                base: baseAlias('scss')
            }
        }
    }
];
