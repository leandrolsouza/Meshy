import {
    isValidMagnetUri,
    isValidTorrentFile,
    hasTorrentMagicBytes,
    isValidSpeedLimit,
    isValidNetworkToggle,
} from '../../main/validators';
import fc from 'fast-check';

// ─── isValidMagnetUri ─────────────────────────────────────────────────────────

describe('isValidMagnetUri', () => {
    const VALID_HASH = 'a'.repeat(40); // 40 hex chars

    it('accepts a minimal valid magnet URI', () => {
        expect(isValidMagnetUri(`magnet:?xt=urn:btih:${VALID_HASH}`)).toBe(true);
    });

    it('accepts a magnet URI with extra query params', () => {
        expect(
            isValidMagnetUri(
                `magnet:?xt=urn:btih:${VALID_HASH}&dn=MyTorrent&tr=udp%3A%2F%2Ftracker.example.com%3A80`,
            ),
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

    // Feature: meshy-torrent-client, Property 4: Validação de Magnet URI
    // **Validates: Requirements 2.1, 2.4**
    describe('property-based tests', () => {
        const MAGNET_PREFIX = 'magnet:?xt=urn:btih:';

        /** Arbitrary that generates exactly 40 hex characters */
        const hexHash40 = fc.stringOf(fc.constantFrom(...'0123456789abcdefABCDEF'.split('')), {
            minLength: 40,
            maxLength: 40,
        });

        /** Arbitrary that generates valid optional query param suffixes */
        const optionalQueryParams = fc.oneof(
            fc.constant(''),
            fc
                .stringOf(
                    fc.constantFrom(
                        ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&=%.+:?_-'.split(
                            '',
                        ),
                    ),
                    { minLength: 1, maxLength: 50 },
                )
                .map((s) => `&${s}`),
        );

        /** Arbitrary that generates whitespace for padding */
        const whitespace = fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), {
            minLength: 0,
            maxLength: 5,
        });

        it('returns true for any valid magnet URI (prefix + 40 hex chars + optional query params)', () => {
            fc.assert(
                fc.property(hexHash40, optionalQueryParams, (hash, params) => {
                    const uri = `${MAGNET_PREFIX}${hash}${params}`;
                    expect(isValidMagnetUri(uri)).toBe(true);
                }),
                { numRuns: 100 },
            );
        });

        it('returns true for valid magnet URIs with leading/trailing whitespace', () => {
            fc.assert(
                fc.property(hexHash40, whitespace, whitespace, (hash, leading, trailing) => {
                    const uri = `${leading}${MAGNET_PREFIX}${hash}${trailing}`;
                    expect(isValidMagnetUri(uri)).toBe(true);
                }),
                { numRuns: 100 },
            );
        });

        it('returns false for any arbitrary string that does not match the magnet pattern', () => {
            const VALID_MAGNET_REGEX =
                /^magnet:\?xt=urn:btih:[a-fA-F0-9]{40}(&[a-zA-Z0-9&=%.+:?_-]*)?$/i;
            fc.assert(
                fc.property(fc.string(), (s) => {
                    const result = isValidMagnetUri(s);
                    const expected = VALID_MAGNET_REGEX.test(s.trim());
                    expect(result).toBe(expected);
                }),
                { numRuns: 100 },
            );
        });

        it('returns false when hash has fewer than 40 hex characters', () => {
            const shortHash = fc.stringOf(fc.constantFrom(...'0123456789abcdef'.split('')), {
                minLength: 0,
                maxLength: 39,
            });
            fc.assert(
                fc.property(shortHash, (hash) => {
                    expect(isValidMagnetUri(`${MAGNET_PREFIX}${hash}`)).toBe(false);
                }),
                { numRuns: 100 },
            );
        });

        it('returns false when hash has more than 40 hex characters', () => {
            const longHash = fc.stringOf(fc.constantFrom(...'0123456789abcdef'.split('')), {
                minLength: 41,
                maxLength: 80,
            });
            fc.assert(
                fc.property(longHash, (hash) => {
                    expect(isValidMagnetUri(`${MAGNET_PREFIX}${hash}`)).toBe(false);
                }),
                { numRuns: 100 },
            );
        });

        it('returns false when hash contains non-hex characters', () => {
            // Generate a 40-char string that has at least one non-hex char
            const nonHexChar = fc.constantFrom(...'ghijklmnopqrstuvwxyz!@#$%^&*()'.split(''));
            const hexChar = fc.constantFrom(...'0123456789abcdef'.split(''));
            const position = fc.integer({ min: 0, max: 39 });

            fc.assert(
                fc.property(
                    fc.array(hexChar, { minLength: 40, maxLength: 40 }),
                    nonHexChar,
                    position,
                    (chars, bad, pos) => {
                        chars[pos] = bad;
                        const hash = chars.join('');
                        expect(isValidMagnetUri(`${MAGNET_PREFIX}${hash}`)).toBe(false);
                    },
                ),
                { numRuns: 100 },
            );
        });
    });
});

// ─── Property 1: Validação de arquivo .torrent (PBT) ──────────────────────────

// Feature: meshy-torrent-client, Property 1: Validação de arquivo .torrent
// **Validates: Requirements 1.1, 1.3**
describe('Property 1: Validação de arquivo .torrent', () => {
    /**
     * Combined validation: returns true iff the file path ends with .torrent
     * AND the buffer starts with 0x64 (bencode dictionary marker).
     */
    function isValidTorrent(filePath: string, buffer: Buffer): boolean {
        return isValidTorrentFile(filePath) && hasTorrentMagicBytes(buffer);
    }

    /** Arbitrary that generates file paths ending with .torrent (case-insensitive) */
    const torrentExtension = fc.constantFrom('.torrent', '.TORRENT', '.Torrent', '.tOrReNt');
    const fileBaseName = fc.stringOf(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')),
        { minLength: 1, maxLength: 30 },
    );
    const torrentFilePath = fc
        .tuple(fileBaseName, torrentExtension)
        .map(([name, ext]) => name + ext);

    /** Arbitrary that generates file paths NOT ending with .torrent */
    const nonTorrentExtension = fc.constantFrom('.txt', '.zip', '.mp4', '.pdf', '.exe', '.bin', '');
    const nonTorrentFilePath = fc
        .tuple(fileBaseName, nonTorrentExtension)
        .map(([name, ext]) => name + ext);

    /** Arbitrary that generates a buffer starting with 0x64 */
    const validMagicBuffer = fc
        .tuple(
            fc.constant(0x64),
            fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 0, maxLength: 50 }),
        )
        .map(([magic, rest]) => Buffer.from([magic, ...rest]));

    /** Arbitrary that generates a buffer NOT starting with 0x64 (including empty) */
    const invalidMagicBuffer = fc.oneof(
        fc.constant(Buffer.alloc(0)),
        fc
            .tuple(
                fc.integer({ min: 0, max: 255 }).filter((b) => b !== 0x64),
                fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 0, maxLength: 50 }),
            )
            .map(([first, rest]) => Buffer.from([first, ...rest])),
    );

    it('returns true when path ends with .torrent AND buffer starts with 0x64', () => {
        fc.assert(
            fc.property(torrentFilePath, validMagicBuffer, (filePath, buffer) => {
                expect(isValidTorrent(filePath, buffer)).toBe(true);
            }),
            { numRuns: 100 },
        );
    });

    it('returns false when path ends with .torrent but buffer does NOT start with 0x64', () => {
        fc.assert(
            fc.property(torrentFilePath, invalidMagicBuffer, (filePath, buffer) => {
                expect(isValidTorrent(filePath, buffer)).toBe(false);
            }),
            { numRuns: 100 },
        );
    });

    it('returns false when path does NOT end with .torrent but buffer starts with 0x64', () => {
        fc.assert(
            fc.property(nonTorrentFilePath, validMagicBuffer, (filePath, buffer) => {
                expect(isValidTorrent(filePath, buffer)).toBe(false);
            }),
            { numRuns: 100 },
        );
    });

    it('returns false when neither condition is met', () => {
        fc.assert(
            fc.property(nonTorrentFilePath, invalidMagicBuffer, (filePath, buffer) => {
                expect(isValidTorrent(filePath, buffer)).toBe(false);
            }),
            { numRuns: 100 },
        );
    });

    it('for any file path and buffer, returns true iff path ends with .torrent AND buffer[0] === 0x64', () => {
        fc.assert(
            fc.property(
                fc.oneof(torrentFilePath, nonTorrentFilePath),
                fc.oneof(validMagicBuffer, invalidMagicBuffer),
                (filePath, buffer) => {
                    const result = isValidTorrent(filePath, buffer);
                    const expectedPath = filePath.toLowerCase().endsWith('.torrent');
                    const expectedMagic = buffer.length > 0 && buffer[0] === 0x64;
                    expect(result).toBe(expectedPath && expectedMagic);
                },
            ),
            { numRuns: 100 },
        );
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

    // Feature: meshy-torrent-client, Property 14: Rejeição de Speed_Limit inválido
    // **Validates: Requirements 6.6**
    describe('Property 14: Rejeição de Speed_Limit inválido', () => {
        it('rejects negative numbers', () => {
            fc.assert(
                fc.property(fc.integer({ min: -1_000_000, max: -1 }), (n) => {
                    expect(isValidSpeedLimit(n)).toBe(false);
                }),
                { numRuns: 100 },
            );
        });

        it('rejects floating-point numbers (non-integer)', () => {
            fc.assert(
                fc.property(
                    fc
                        .double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true })
                        .filter((n) => !Number.isInteger(n)),
                    (n) => {
                        expect(isValidSpeedLimit(n)).toBe(false);
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('rejects strings', () => {
            fc.assert(
                fc.property(fc.string(), (s) => {
                    expect(isValidSpeedLimit(s)).toBe(false);
                }),
                { numRuns: 100 },
            );
        });

        it('rejects null and undefined', () => {
            expect(isValidSpeedLimit(null)).toBe(false);
            expect(isValidSpeedLimit(undefined)).toBe(false);
        });

        it('rejects NaN and Infinity', () => {
            expect(isValidSpeedLimit(NaN)).toBe(false);
            expect(isValidSpeedLimit(Infinity)).toBe(false);
            expect(isValidSpeedLimit(-Infinity)).toBe(false);
        });

        it('rejects objects, arrays, booleans, and other non-integer types', () => {
            fc.assert(
                fc.property(
                    fc.oneof(
                        fc.object(),
                        fc.array(fc.anything()),
                        fc.boolean(),
                        fc.constant(null),
                        fc.constant(undefined),
                        fc.constant(NaN),
                        fc.constant(Infinity),
                        fc.constant(-Infinity),
                        fc.constant(Symbol('test')),
                    ),
                    (value) => {
                        expect(isValidSpeedLimit(value)).toBe(false);
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('accepts only non-negative integers and rejects everything else', () => {
            fc.assert(
                fc.property(
                    fc.oneof(
                        // Valid: non-negative integers
                        fc.nat().map((n) => ({ value: n, expected: true })),
                        // Invalid: negative integers
                        fc
                            .integer({ min: -1_000_000, max: -1 })
                            .map((n) => ({ value: n, expected: false })),
                        // Invalid: floats
                        fc
                            .double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true })
                            .filter((n) => !Number.isInteger(n))
                            .map((n) => ({ value: n, expected: false })),
                        // Invalid: strings
                        fc.string().map((s) => ({ value: s, expected: false })),
                        // Invalid: null/undefined
                        fc.constant({ value: null, expected: false }),
                        fc.constant({ value: undefined, expected: false }),
                    ),
                    ({ value, expected }) => {
                        expect(isValidSpeedLimit(value)).toBe(expected);
                    },
                ),
                { numRuns: 100 },
            );
        });
    });
});

// ─── Importações para testes de Tracker URL ───────────────────────────────────

import {
    isValidTrackerUrl,
    normalizeTrackerUrl,
} from '../../shared/validators';

// ─── isValidTrackerUrl (testes unitários) ─────────────────────────────────────

describe('isValidTrackerUrl', () => {
    it('aceita URL http com hostname', () => {
        expect(isValidTrackerUrl('http://tracker.example.com:6969/announce')).toBe(true);
    });

    it('aceita URL https com hostname', () => {
        expect(isValidTrackerUrl('https://tracker.example.com/announce')).toBe(true);
    });

    it('aceita URL udp com hostname e porta', () => {
        expect(isValidTrackerUrl('udp://tracker.example.com:6969/announce')).toBe(true);
    });

    it('aceita URL udp sem path', () => {
        expect(isValidTrackerUrl('udp://tracker.example.com:6969')).toBe(true);
    });

    it('aceita URL http sem /announce no path', () => {
        expect(isValidTrackerUrl('http://tracker.example.com:8080')).toBe(true);
    });

    it('rejeita string vazia', () => {
        expect(isValidTrackerUrl('')).toBe(false);
    });

    it('rejeita string com apenas espaços', () => {
        expect(isValidTrackerUrl('   ')).toBe(false);
    });

    it('rejeita protocolo ftp', () => {
        expect(isValidTrackerUrl('ftp://tracker.example.com/announce')).toBe(false);
    });

    it('rejeita protocolo wss', () => {
        expect(isValidTrackerUrl('wss://tracker.example.com/announce')).toBe(false);
    });

    it('rejeita string sem protocolo', () => {
        expect(isValidTrackerUrl('tracker.example.com/announce')).toBe(false);
    });

    it('rejeita URL com protocolo válido mas sem hostname', () => {
        expect(isValidTrackerUrl('http://')).toBe(false);
    });

    it('aceita URL com espaços ao redor (trim)', () => {
        expect(isValidTrackerUrl('  http://tracker.example.com  ')).toBe(true);
    });
});

// ─── normalizeTrackerUrl (testes unitários) ────────────────────────────────────

describe('normalizeTrackerUrl', () => {
    it('remove espaços no início e fim', () => {
        expect(normalizeTrackerUrl('  http://tracker.example.com  ')).toBe(
            'http://tracker.example.com',
        );
    });

    it('converte protocolo para minúsculas', () => {
        expect(normalizeTrackerUrl('HTTP://tracker.example.com')).toBe(
            'http://tracker.example.com',
        );
    });

    it('converte protocolo UDP para minúsculas', () => {
        expect(normalizeTrackerUrl('UDP://tracker.example.com:6969')).toBe(
            'udp://tracker.example.com:6969',
        );
    });

    it('remove barras finais duplicadas', () => {
        expect(normalizeTrackerUrl('http://tracker.example.com/announce///')).toBe(
            'http://tracker.example.com/announce',
        );
    });

    it('remove barra final única', () => {
        expect(normalizeTrackerUrl('http://tracker.example.com/')).toBe(
            'http://tracker.example.com',
        );
    });

    it('não altera URL já normalizada', () => {
        const url = 'http://tracker.example.com/announce';
        expect(normalizeTrackerUrl(url)).toBe(url);
    });

    it('aplica trim e lowercase de protocolo juntos', () => {
        expect(normalizeTrackerUrl('  HTTPS://Tracker.Example.COM/announce/  ')).toBe(
            'https://Tracker.Example.COM/announce',
        );
    });
});

// ─── PBT: Propriedade 1 — URLs válidas aceitas, protocolos inválidos rejeitados ───

// Feature: tracker-management, Propriedade 1: Validação de Tracker URL
// **Validates: Requirements 7.1, 7.2**
describe('[PBT] Propriedade 1: URLs com protocolos válidos são aceitas; protocolos inválidos são rejeitados', () => {
    /** Gerador de hostnames válidos */
    const validHostname = fc
        .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
            minLength: 1,
            maxLength: 20,
        })
        .map((s) => s + '.com');

    /** Gerador de portas opcionais */
    const optionalPort = fc.oneof(
        fc.constant(''),
        fc.integer({ min: 1, max: 65535 }).map((p) => `:${p}`),
    );

    /** Gerador de paths opcionais */
    const optionalPath = fc.oneof(
        fc.constant(''),
        fc.constant('/announce'),
        fc.constant('/scrape'),
        fc
            .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789/-_'.split('')), {
                minLength: 1,
                maxLength: 20,
            })
            .map((s) => '/' + s),
    );

    /** Protocolos válidos */
    const validProtocol = fc.constantFrom('http', 'https', 'udp');

    /** Protocolos inválidos */
    const invalidProtocol = fc.constantFrom('ftp', 'wss', 'ws', 'ssh', 'magnet', 'irc', 'smtp');

    it('aceita URLs com protocolos válidos e hostname não-vazio', () => {
        fc.assert(
            fc.property(
                validProtocol,
                validHostname,
                optionalPort,
                optionalPath,
                (proto, host, port, path) => {
                    const url = `${proto}://${host}${port}${path}`;
                    expect(isValidTrackerUrl(url)).toBe(true);
                },
            ),
            { numRuns: 200 },
        );
    });

    it('rejeita URLs com protocolos inválidos', () => {
        fc.assert(
            fc.property(
                invalidProtocol,
                validHostname,
                optionalPort,
                optionalPath,
                (proto, host, port, path) => {
                    const url = `${proto}://${host}${port}${path}`;
                    expect(isValidTrackerUrl(url)).toBe(false);
                },
            ),
            { numRuns: 200 },
        );
    });
});

// ─── PBT: Propriedade 2 — Normalização é idempotente ──────────────────────────

// Feature: tracker-management, Propriedade 2: Normalização idempotente
// **Validates: Requirements 7.4**
describe('[PBT] Propriedade 2: normalização é idempotente', () => {
    /** Gerador de URLs válidas com variações de casing e espaços */
    const validTrackerUrl = fc
        .tuple(
            fc.constantFrom('http', 'https', 'udp', 'HTTP', 'HTTPS', 'UDP', 'Http', 'Udp'),
            fc
                .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
                    minLength: 1,
                    maxLength: 15,
                })
                .map((s) => s + '.com'),
            fc.oneof(
                fc.constant(''),
                fc.integer({ min: 1, max: 65535 }).map((p) => `:${p}`),
            ),
            fc.oneof(fc.constant(''), fc.constant('/announce'), fc.constant('/scrape')),
            fc.oneof(fc.constant(''), fc.constant('/'), fc.constant('//'), fc.constant('///')),
            fc.stringOf(fc.constant(' '), { minLength: 0, maxLength: 3 }),
            fc.stringOf(fc.constant(' '), { minLength: 0, maxLength: 3 }),
        )
        .map(
            ([proto, host, port, path, trailingSlashes, leadingSpaces, trailingSpaces]) =>
                `${leadingSpaces}${proto}://${host}${port}${path}${trailingSlashes}${trailingSpaces}`,
        );

    it('normalizeTrackerUrl(normalizeTrackerUrl(u)) === normalizeTrackerUrl(u) para toda URL válida', () => {
        fc.assert(
            fc.property(validTrackerUrl, (url) => {
                const once = normalizeTrackerUrl(url);
                const twice = normalizeTrackerUrl(once);
                expect(twice).toBe(once);
            }),
            { numRuns: 200 },
        );
    });
});

// ─── PBT: Propriedade 3 — Round-trip ──────────────────────────────────────────

// Feature: tracker-management, Propriedade 3: Round-trip
// **Validates: Requirements 7.4**
describe('[PBT] Propriedade 3: round-trip — isValidTrackerUrl(normalizeTrackerUrl(u)) é true para toda URL válida', () => {
    /** Gerador de URLs válidas com variações */
    const validTrackerUrl = fc
        .tuple(
            fc.constantFrom('http', 'https', 'udp', 'HTTP', 'HTTPS', 'UDP', 'Http', 'Udp'),
            fc
                .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
                    minLength: 1,
                    maxLength: 15,
                })
                .map((s) => s + '.com'),
            fc.oneof(
                fc.constant(''),
                fc.integer({ min: 1, max: 65535 }).map((p) => `:${p}`),
            ),
            fc.oneof(fc.constant(''), fc.constant('/announce'), fc.constant('/scrape')),
            fc.stringOf(fc.constant(' '), { minLength: 0, maxLength: 3 }),
            fc.stringOf(fc.constant(' '), { minLength: 0, maxLength: 3 }),
        )
        .map(
            ([proto, host, port, path, leadingSpaces, trailingSpaces]) =>
                `${leadingSpaces}${proto}://${host}${port}${path}${trailingSpaces}`,
        );

    it('isValidTrackerUrl(normalizeTrackerUrl(u)) é true para toda URL válida u', () => {
        fc.assert(
            fc.property(validTrackerUrl, (url) => {
                const normalized = normalizeTrackerUrl(url);
                expect(isValidTrackerUrl(normalized)).toBe(true);
            }),
            { numRuns: 200 },
        );
    });
});

// ─── isValidNetworkToggle (testes unitários) ──────────────────────────────────

describe('isValidNetworkToggle', () => {
    it('aceita true', () => {
        expect(isValidNetworkToggle(true)).toBe(true);
    });

    it('aceita false', () => {
        expect(isValidNetworkToggle(false)).toBe(true);
    });

    it('rejeita null', () => {
        expect(isValidNetworkToggle(null)).toBe(false);
    });

    it('rejeita undefined', () => {
        expect(isValidNetworkToggle(undefined)).toBe(false);
    });

    it('rejeita número', () => {
        expect(isValidNetworkToggle(0)).toBe(false);
        expect(isValidNetworkToggle(1)).toBe(false);
        expect(isValidNetworkToggle(42)).toBe(false);
    });

    it('rejeita string', () => {
        expect(isValidNetworkToggle('')).toBe(false);
        expect(isValidNetworkToggle('true')).toBe(false);
        expect(isValidNetworkToggle('false')).toBe(false);
    });
});

// ─── PBT: Propriedade 1 — Validação rejeita valores não-booleanos ─────────────

// Feature: dht-pex-settings, Property 1: Validação rejeita valores não-booleanos
// **Validates: Requirements 2.1, 2.2**
describe('[PBT] Propriedade 1: Para qualquer não-booleano, isValidNetworkToggle retorna false; para qualquer booleano, retorna true', () => {
    it('retorna true para qualquer valor booleano', () => {
        fc.assert(
            fc.property(fc.boolean(), (value) => {
                expect(isValidNetworkToggle(value)).toBe(true);
            }),
            { numRuns: 100 },
        );
    });

    it('retorna false para qualquer valor não-booleano', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.integer(),
                    fc.string(),
                    fc.double({ noNaN: true, noDefaultInfinity: true }),
                    fc.constant(null),
                    fc.constant(undefined),
                    fc.object(),
                    fc.array(fc.anything()),
                ),
                (value) => {
                    expect(isValidNetworkToggle(value)).toBe(false);
                },
            ),
            { numRuns: 200 },
        );
    });
});
