/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProgressBar } from '../../src/components/common/ProgressBar';

// ─── Unit tests for ProgressBar variant prop ──────────────────────────────────
// Requisitos: 7.4, 7.5, 7.6

describe('ProgressBar — variant prop', () => {
    it('applies the default fill class when no variant is provided', () => {
        const { container } = render(<ProgressBar value={50} />);
        const fill = container.querySelector('[role="progressbar"] > div');

        expect(fill).toHaveClass('fill');
        expect(fill).toHaveClass('fillDefault');
    });

    it('applies the default fill class when variant="default"', () => {
        const { container } = render(<ProgressBar value={50} variant="default" />);
        const fill = container.querySelector('[role="progressbar"] > div');

        expect(fill).toHaveClass('fill');
        expect(fill).toHaveClass('fillDefault');
    });

    it('applies the success fill class when variant="success"', () => {
        const { container } = render(<ProgressBar value={100} variant="success" />);
        const fill = container.querySelector('[role="progressbar"] > div');

        expect(fill).toHaveClass('fill');
        expect(fill).toHaveClass('fillSuccess');
    });

    it('applies the error fill class when variant="error"', () => {
        const { container } = render(<ProgressBar value={30} variant="error" />);
        const fill = container.querySelector('[role="progressbar"] > div');

        expect(fill).toHaveClass('fill');
        expect(fill).toHaveClass('fillError');
    });
});
