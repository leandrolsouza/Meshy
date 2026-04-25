/**
 * @jest-environment jsdom
 */

/**
 * Property-Based Tests for FileSelector component.
 *
 * Feature: torrent-file-selection
 * - Property 3: FileSelector renderiza informações completas e acessíveis
 * - Property 4: Estado indeterminado do "Selecionar todos"
 * - Property 5: Tamanho total reflete seleção
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import fc from 'fast-check';
import type { TorrentFileInfo } from '../../shared/types';
import { formatBytes } from '../../src/utils/formatters';
import { FileSelector } from '../../src/components/FileSelector/FileSelector';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generates a non-empty file name */
const fileNameArb = fc.stringMatching(/^[a-zA-Z0-9_.-]{1,40}$/).filter((s) => s.length > 0);

/** Generates a single TorrentFileInfo */
const torrentFileInfoArb = (index: number): fc.Arbitrary<TorrentFileInfo> =>
    fc.record({
        index: fc.constant(index),
        name: fileNameArb,
        path: fc.tuple(
            fc.stringMatching(/^[a-zA-Z0-9_-]{1,15}$/).filter((s) => s.length > 0),
            fileNameArb,
        ).map(([dir, name]) => `${dir}/${name}`),
        length: fc.nat({ max: 10_000_000 }),
        downloaded: fc.nat({ max: 10_000_000 }),
        selected: fc.boolean(),
    });

/** Generates an array of 1..15 TorrentFileInfo with sequential indices */
const fileArrayArb = (minLength = 1, maxLength = 15): fc.Arbitrary<TorrentFileInfo[]> =>
    fc.integer({ min: minLength, max: maxLength }).chain((n) =>
        fc.tuple(...Array.from({ length: n }, (_, i) => torrentFileInfoArb(i))),
    ).map((tuple) => [...tuple]);

/** Generates an array where ALL files are selected */
const allSelectedFileArrayArb = (minLength = 2, maxLength = 15): fc.Arbitrary<TorrentFileInfo[]> =>
    fc.integer({ min: minLength, max: maxLength }).chain((n) =>
        fc.tuple(
            ...Array.from({ length: n }, (_, i) =>
                torrentFileInfoArb(i).map((f) => ({ ...f, selected: true })),
            ),
        ),
    ).map((tuple) => [...tuple]);

// ─── Property 3: FileSelector renderiza informações completas e acessíveis ────

/**
 * Feature: torrent-file-selection, Property 3: FileSelector renderiza informações completas e acessíveis
 *
 * For any list of TorrentFileInfo[] with at least 1 file, the FileSelector must
 * render for each file: an <input type="checkbox"> with <label> associated,
 * the file name visible, and the size formatted via formatBytes.
 *
 * **Validates: Requirements 3.1, 7.1**
 */
describe('Feature: torrent-file-selection, Property 3: FileSelector renderiza informações completas e acessíveis', () => {
    it('renders a checkbox with associated label, file name, and formatted size for each file', () => {
        fc.assert(
            fc.property(fileArrayArb(1, 10), (files) => {
                const { container, unmount } = render(
                    <FileSelector files={files} onSelectionChange={jest.fn()} />,
                );

                for (const file of files) {
                    // Each file has a checkbox with the correct id
                    const checkbox = container.querySelector(
                        `#file-checkbox-${file.index}`,
                    ) as HTMLInputElement;
                    expect(checkbox).not.toBeNull();
                    expect(checkbox.type).toBe('checkbox');

                    // The checkbox has an associated label (via htmlFor)
                    const label = container.querySelector(
                        `label[for="file-checkbox-${file.index}"]`,
                    );
                    expect(label).not.toBeNull();

                    // The file name is visible within the label
                    expect(label!.textContent).toContain(file.name);

                    // The formatted size is visible within the label
                    expect(label!.textContent).toContain(formatBytes(file.length));
                }

                unmount();
            }),
            { numRuns: 100 },
        );
    });
});

// ─── Property 4: Estado indeterminado do "Selecionar todos" ───────────────────

/**
 * Feature: torrent-file-selection, Property 4: Estado indeterminado do "Selecionar todos"
 *
 * For any list of files with N ≥ 2, if all are selected and exactly one is
 * deselected, the "Select all" checkbox must be in the indeterminate state
 * (aria-checked="mixed").
 *
 * **Validates: Requirements 3.3, 7.3**
 */
describe('Feature: torrent-file-selection, Property 4: Estado indeterminado do "Selecionar todos"', () => {
    it('shows aria-checked="mixed" on "Select all" when all selected except one', () => {
        fc.assert(
            fc.property(
                allSelectedFileArrayArb(2, 10).chain((files) =>
                    fc.tuple(
                        fc.constant(files),
                        fc.integer({ min: 0, max: files.length - 1 }),
                    ),
                ),
                ([files, deselectedIndex]) => {
                    // Deselect exactly one file
                    const modifiedFiles = files.map((f, i) =>
                        i === deselectedIndex ? { ...f, selected: false } : f,
                    );

                    const { container, unmount } = render(
                        <FileSelector files={modifiedFiles} onSelectionChange={jest.fn()} />,
                    );

                    // Find the "Select all" checkbox — it's the one inside the header label
                    const selectAllCheckbox = container.querySelector(
                        'input[type="checkbox"][aria-checked="mixed"]',
                    ) as HTMLInputElement;

                    expect(selectAllCheckbox).not.toBeNull();
                    expect(selectAllCheckbox.getAttribute('aria-checked')).toBe('mixed');

                    unmount();
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ─── Property 5: Tamanho total reflete seleção ───────────────────────────────

/**
 * Feature: torrent-file-selection, Property 5: Tamanho total reflete seleção
 *
 * For any set of TorrentFileInfo[] with arbitrary selections, the total size
 * displayed by the FileSelector must equal the sum of `length` fields of files
 * where `selected = true`.
 *
 * **Validates: Requirements 3.5**
 */
describe('Feature: torrent-file-selection, Property 5: Tamanho total reflete seleção', () => {
    it('displays total size equal to sum of selected file lengths', () => {
        fc.assert(
            fc.property(fileArrayArb(1, 10), (files) => {
                const { unmount } = render(
                    <FileSelector files={files} onSelectionChange={jest.fn()} />,
                );

                const expectedTotal = files
                    .filter((f) => f.selected)
                    .reduce((sum, f) => sum + f.length, 0);

                const expectedDownloaded = files
                    .filter((f) => f.selected)
                    .reduce((sum, f) => sum + f.downloaded, 0);

                const totalSizeElement = screen.getByTestId('total-selected-size');
                expect(totalSizeElement.textContent).toBe(
                    `${formatBytes(expectedDownloaded)} / ${formatBytes(expectedTotal)}`,
                );

                unmount();
            }),
            { numRuns: 100 },
        );
    });
});
