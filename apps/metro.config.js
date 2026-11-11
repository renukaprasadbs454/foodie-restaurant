const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRnRoot = path.resolve(projectRoot, 'packages/shared-rn');

const config = getDefaultConfig(projectRoot);

if (config.server && 'tls' in config.server) {
    delete config.server.tls;
}

config.watchFolders = [projectRoot];

config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = false;

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

    const dedupedPackages = [
        'react',
        'react-dom',
        'react-native',
        'react-redux',
        '@react-navigation/native',
        '@react-navigation/native-stack'
    ];

    for (const pkg of dedupedPackages) {
        if (moduleName === pkg || moduleName.startsWith(pkg + '/')) {
            return context.resolveRequest(
                context,
                moduleName.replace(pkg, path.resolve(projectRoot, 'node_modules', pkg)),
                platform
            );
        }
    }

    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
