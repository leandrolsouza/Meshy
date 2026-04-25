import {
    isValidMagnetUri,
    isValidTorrentFile,
    hasTorrentMagicBytes,
    isValidSpeedLimit,
} from '../../main/validators';

// ─── isValidMagnetUri ─────────────────────────────────────────────────────────

describe('isValidMagnetUri', () => {
    const VALID_HASH = 'a'.repeat(40); // 40 hex chars

    it('accepts a minimal valid magnet URI', () => {
        expect(isValidMagnetUri(`magnet:?xt=urn:btih:${VALID_HASH}`)).toBe(true);
    });

    it('accepts a magnet URI with extra query params', () => {
        expect(
            isValidMagnetUri(`magnet:?xt=urn:btih:${VALID_HASH}&dn=MyTorrent&tr=udp%3A%2F%2Ftracker.example.com%3A80`)
        ).toBe(true);
    });

    it('accepts uppercase hex hash', () => {
        expect(isValidMagnetUri(`magnet:?xt=urn:btih:${'A'.repeat(40)}`)).toBe(true);
    });

    it('rejects empty string', () => {
        expect(isValidMagnetUri('')).toBe(false);
    });

    it('rejects URI with hash shorter than 40 chars', () => {
        expect(isValidMagnetUri(`magnet:?xt=urn:btih:${'a'.repeat(39)}`)).toBe(false);
    });

    it('rejects URI with hash longer than 40 chars', () => {
        expect(isValidMagnetUri(`magnet:?xt=urn:btih:${'a'.repeat(41)}`)).toBe(false);
    });

    it('rejects URI with non-hex characters in hash', () => {
        expect(isValidMagnetUri(`magnet:?xt=urn:btih:${'g'.repeat(40)}`)).toBe(false);
    });

    it('rejects plain http URL', () => {
        expect(isValidMagnetUri('http://example.com/file.torrent')).toBe(false);
    });

    it('rejects magnet URI missing xt param', () => {
        expect(isValidMagnetUri('magnet:?dn=SomeName')).toBe(false);
    });

    it('trims leading/trailing whitespace before validating', () => {
        expect(isValidMagnetUri(`  magnet:?xt=urn:btih:${VALID_HASH}  `)).toBe(true);
    });
});

// ─── isValidTorrentFile ───────────────────────────────────────────────────────

describe('isValidTorrentFile', () => {
    it('accepts a path ending with .torrent', () => {
        expect(isValidTorrentFile('/home/user/downloads/file.torrent')).toBe(true);
    });

    it('accepts a path ending with .TORRENT (uppercase)', () => {
        expect(isValidTorrentFile('/home/user/downloads/file.TORRENT')).toBe(true);
    });

    it('accepts a bare filename with .torrent extension', () => {
        expect(isValidTorrentFile('ubuntu.torrent')).toBe(true);
    });

    it('rejects a path ending with .txt', () => {
        expect(isValidTorrentFile('/home/user/file.txt')).toBe(false);
    });

    it('rejects a path ending with .torrent.bak', () => {
        expect(isValidTorrentFile('/home/user/file.torrent.bak')).toBe(false);
    });

    it('rejects an empty string', () => {
        expect(isValidTorrentFile('')).toBe(false);
    });

    it('rejects a path with no extension', () => {
        expect(isValidTorrentFile('/home/user/torrent')).toBe(false);
    });
});

// ─── hasTorrentMagicBytes ─────────────────────────────────────────────────────

describe('hasTorrentMagicBytes', () => {
    it('returns true for a buffer starting with 0x64 (d)', () => {
        const buf = Buffer.from([0x64, 0x00, 0x01]);
        expect(hasTorrentMagicBytes(buf)).toBe(true);
    });

    it('returns true for a buffer that is exactly [0x64]', () => {
        const buf = Buffer.from([0x64]);
        expect(hasTorrentMagicBytes(buf)).toBe(true);
    });

    it('returns false for a buffer starting with a different byte', () => {
        const buf = Buffer.from([0x65, 0x64]); // starts with 'e', not 'd'
        expect(hasTorrentMagicBytes(buf)).toBe(false);
    });

    it('returns false for an empty buffer', () => {
        const buf = Buffer.alloc(0);
        expect(hasTorrentMagicBytes(buf)).toBe(false);
    });

    it('returns false for a buffer starting with 0x00', () => {
        const buf = Buffer.from([0x00, 0x64]);
        expect(hasTorrentMagicBytes(buf)).toBe(false);
    });
});

// ─── isValidSpeedLimit ────────────────────────────────────────────────────────

describe('isValidSpeedLimit', () => {
    it('accepts 0 (no limit)', () => {
        expect(isValidSpeedLimit(0)).toBe(true);
    });

    it('accepts positive integers', () => {
        expect(isValidSpeedLimit(1)).toBe(true);
        expect(isValidSpeedLimit(512)).toBe(true);
        expect(isValidSpeedLimit(10000)).toBe(true);
    });

    it('rejects negative integers', () => {
        expect(isValidSpeedLimit(-1)).toBe(false);
        expect(isValidSpeedLimit(-100)).toBe(false);
    });

    it('rejects floating-point numbers', () => {
        expect(isValidSpeedLimit(1.5)).toBe(false);
        expect(isValidSpeedLimit(0.1)).toBe(false);
    });

    it('rejects strings', () => {
        expect(isValidSpeedLimit('100')).toBe(false);
        expect(isValidSpeedLimit('0')).toBe(false);
    });

    it('rejects null and undefined', () => {
        expect(isValidSpeedLimit(null)).toBe(false);
        expect(isValidSpeedLimit(undefined)).toBe(false);
    });

    it('rejects NaN', () => {
        expect(isValidSpeedLimit(NaN)).toBe(false);
    });

    it('rejects Infinity', () => {
        expect(isValidSpeedLimit(Infinity)).toBe(false);
    });

    it('rejects objects and arrays', () => {
        expect(isValidSpeedLimit({})).toBe(false);
        expect(isValidSpeedLimit([])).toBe(false);
    });
});
