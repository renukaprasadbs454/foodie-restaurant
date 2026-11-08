const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRnRoot = path.resolve(projectRoot, 'packages/shared-rn');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [projectRoot, sharedRnRoot];

config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = false;

config.resolver.extraNodeModules = {
    react: path.resolve(projectRoot, 'node_modules/react'),
    'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
    'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
    'react-redux': path.resolve(projectRoot, 'node_modules/react-redux'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web' && moduleName === 'react-native-maps') {
        return context.resolveRequest(context, '@teovilla/react-native-web-maps', platform);
    }

    if (moduleName === 'foodie-shared-rn') {
        return {
            type: 'sourceFile',
            filePath: path.resolve(sharedRnRoot, 'src/index.ts'),
        };
    }

    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
