/** @type {import('jest').Config} */
const config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests', '<rootDir>/main', '<rootDir>/src'],
    testMatch: [
        '**/__tests__/**/*.ts',
        '**/__tests__/**/*.tsx',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
    ],
    transform: {
        '^.+\\.[cm]?js$': [
            'babel-jest',
            {
                babelrc: false,
                configFile: false,
                plugins: ['@babel/plugin-transform-modules-commonjs'],
            },
        ],
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.jest.json',
            },
        ],
    },
    // React Intl 12 e suas dependências publicam somente ESM.
    transformIgnorePatterns: ['node_modules/(?!(react-intl/|@formatjs/|intl-messageformat/))'],
    moduleNameMapper: {
        '\\.module\\.css$': 'identity-obj-proxy',
        '^@renderer/(.*)$': '<rootDir>/src/$1',
    },
    collectCoverageFrom: ['main/**/*.ts', 'src/**/*.ts', '!**/*.d.ts', '!**/index.ts'],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    setupFiles: ['<rootDir>/tests/setup.ts'],
};

module.exports = config;
