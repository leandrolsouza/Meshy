/* global require, __dirname, console, process, Buffer, setTimeout, clearTimeout, setImmediate */
// Verify the installed WebTorrent/tracker contract without external network requests.
// WebRTC is disabled because npm ci --ignore-scripts does not install native binaries.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { registerHooks, stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '..');
function load(file, bindings, names) {
    let source = stripTypeScriptTypes(fs.readFileSync(path.join(root, file), 'utf8'));
    source = source.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];[ \t]*$/gm, '');
    source = source.replace(/\bexport (?=(?:async )?(?:function|class|const))/g, '');
    return new Function(...Object.keys(bindings), `${source}\nreturn {${names.join(',')}};`)(
        ...Object.values(bindings),
    );
}
const hooks = registerHooks({
    resolve(specifier, context, next) {
        if (specifier === 'webrtc-polyfill') {
            return {
                url: 'data:text/javascript,export const RTCPeerConnection=undefined,RTCSessionDescription=undefined,RTCIceCandidate=undefined;',
                shortCircuit: true,
            };
        }
        return next(specifier, context);
    },
});

(async () => {
    const { default: WebTorrent } = await import('webtorrent');
    const { Client: Tracker } = await import('bittorrent-tracker');
    const { default: bencode } = await import('bencode');
    // Keep real tracker objects, arrays, constructors and cleanup; suppress announces.
    const start = Tracker.prototype.start;
    const stop = Tracker.prototype.stop;
    Tracker.prototype.start = function () {
        this._trackers.forEach((tracker) => tracker.setInterval(0));
    };
    Tracker.prototype.stop = function () {};
    const validators = load('shared/validators.ts', {}, [
        'isValidMagnetUri',
        'hasTorrentMagicBytes',
        'isValidTrackerUrl',
        'normalizeTrackerUrl',
    ]);
    const internals = load('main/webtorrentInternals.ts', {}, [
        'getAnnounceList',
        'setAnnounceList',
        'getInternalTrackers',
        'getInternalTrackerStatus',
        'destroyInternalTracker',
        'addTrackerToTorrent',
        'configureTorrentNetwork',
        'stopTorrentNetwork',
        'resumeTorrentNetwork',
        'getNumSeeders',
        'getBitfield',
        'getPiecesCount',
        'getTorrentCreatedInfo',
        'getWiresWithPeerInfo',
    ]);
    const { createTorrentEngine } = load(
        'main/torrentEngine.ts',
        {
            EventEmitter,
            ...fs.promises,
            join: path.join,
            WebTorrent,
            ...validators,
            ...internals,
            setTimeout,
            clearTimeout,
            logger: { warn() {} },
        },
        ['createTorrentEngine'],
    );
    const folder = path.join(root, 'node_modules/.cache/network-library-check');
    fs.mkdirSync(folder, { recursive: true });
    const client = new WebTorrent({
        dht: false,
        lsd: false,
        utp: false,
        utPex: false,
        natUpnp: false,
        natPmp: false,
        tracker: { wrtc: false },
    });
    try {
        const engine = createTorrentEngine(
            {
                downloadPath: folder,
                downloadSpeedLimit: 0,
                uploadSpeedLimit: 0,
                dhtEnabled: false,
                pexEnabled: false,
                utpEnabled: false,
            },
            client,
        );
        engine.on('error', (hash, err) => {
            throw new Error(`${hash}: ${err.message}`);
        });
        const hash = '1'.repeat(40);
        const info = await engine.addMagnetLink(`magnet:?xt=urn:btih:${hash}`);
        assert.equal(info.status, 'resolving-metadata');
        await new Promise((resolve) =>
            client.listening ? resolve() : client.once('listening', resolve),
        );
        await new Promise(setImmediate);
        const torrent = client.torrents[0];
        assert.ok(torrent.discovery);
        await engine.pause(hash);
        assert.equal(torrent.discovery, null);
        await engine.resume(hash);
        assert.ok(torrent.discovery);
        engine.addTracker(hash, 'udp://tracker.example.com:6969/announce');
        engine.addTracker(hash, 'https://tracker.example.com/announce');
        await new Promise(setImmediate);
        assert.equal(torrent.discovery.tracker._trackers.length, 2);
        const removed = torrent.discovery.tracker._trackers.find((tracker) =>
            tracker.announceUrl.startsWith('udp:'),
        );
        engine.removeTracker(hash, removed.announceUrl);
        assert.equal(removed.destroyed, true);
        assert.equal(torrent.discovery.tracker._trackers.length, 1);
        await engine.pause(hash);
        await engine.resume(hash);
        assert.equal(torrent.discovery.tracker._trackers.length, 1);
        const buffer = Buffer.from(
            bencode.encode({
                info: {
                    name: 'offline-contract.bin',
                    length: 1,
                    'piece length': 16384,
                    pieces: Buffer.alloc(20),
                },
            }),
        );
        const queued = await engine.addTorrentBuffer(buffer, true);
        const paused = client.torrents.find((item) => item.infoHash === queued.infoHash);
        assert.equal(queued.status, 'paused');
        assert.ok(!paused.discovery);
        await assert.rejects(engine.addTorrentBuffer(buffer, true), /duplicate/i);
        assert.equal(
            engine.getAll().find((item) => item.infoHash === queued.infoHash).status,
            'paused',
        );
        await engine.resume(queued.infoHash);
        assert.ok(paused.discovery);
        // Exercise real Peer/_drain code while replacing only TCP socket creation.
        const net = require('node:net');
        const connect = net.connect;
        let attempts = 0;
        net.connect = () => {
            attempts++;
            const socket = new EventEmitter();
            socket.destroy = () => socket.emit('close');
            return socket;
        };
        try {
            const swarms = [torrent];
            for (const digit of ['2', '3', '4', '5']) {
                await engine.addMagnetLink(`magnet:?xt=urn:btih:${digit.repeat(40)}`);
                await new Promise(setImmediate);
                swarms.push(client.torrents.find((item) => item.infoHash === digit.repeat(40)));
            }
            for (const swarm of swarms) {
                for (let i = 0; i < 200; i++) swarm.addPeer(`198.51.100.${i + 1}:${4000 + i}`);
            }
            assert.equal(attempts, 96);
            assert.equal([...torrent._peers.values()].filter((peer) => peer.conn).length, 24);
            for (const swarm of swarms) {
                await engine.pause(swarm.infoHash);
                assert.equal(swarm._queue.length, 0);
                assert.equal(swarm._peers.size, 0);
                await engine.resume(swarm.infoHash);
                await engine.pause(swarm.infoHash);
            }
        } finally {
            for (const swarm of client.torrents) await engine.pause(swarm.infoHash);
            net.connect = connect;
        }
        console.log(
            'Installed library contract: magnets, pause/resume, trackers, queued buffers, 96 pending connections across five torrents — PASS',
        );
    } finally {
        await new Promise((resolve, reject) =>
            client.destroy((err) => (err ? reject(err) : resolve())),
        );
        Tracker.prototype.start = start;
        Tracker.prototype.stop = stop;
        hooks.deregister();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
