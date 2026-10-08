/* global require, __dirname, console, process */
// Regression runner for the network fixes. No external connections are opened.
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const jest = path.join(root, 'node_modules/jest/bin/jest.js');
if (!fs.existsSync(jest)) {
    console.error('Install project dependencies with npm ci before running this check.');
    process.exit(1);
}
const result = spawnSync(
    process.execPath,
    [
        jest,
        'tests/unit/networkLifecycle.test.ts',
        'tests/unit/torrentEngine.test.ts',
        'tests/unit/downloadManager.test.ts',
        '--runInBand',
        '--cacheDirectory',
        path.join(root, 'node_modules/.cache/jest'),
    ],
    { cwd: root, stdio: 'inherit' },
);
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
