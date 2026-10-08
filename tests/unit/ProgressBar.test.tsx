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

// ─── Unit tests for ProgressBar ARIA attributes ───────────────────────────────
// Requisito: 8.4

describe('ProgressBar — ARIA attributes', () => {
    it('renders with role="progressbar"', () => {
        const { getByRole } = render(<ProgressBar value={50} />);

        expect(getByRole('progressbar')).toBeInTheDocument();
    });

    it('sets aria-valuemin=0 and aria-valuemax=100 regardless of max prop', () => {
        const { getByRole } = render(<ProgressBar value={3} max={10} />);
        const bar = getByRole('progressbar');

        expect(bar).toHaveAttribute('aria-valuemin', '0');
        expect(bar).toHaveAttribute('aria-valuemax', '100');
    });

    it('aria-valuemax is always 100 even when max prop differs', () => {
        const { getByRole } = render(<ProgressBar value={200} max={500} />);
        const bar = getByRole('progressbar');

        expect(bar).toHaveAttribute('aria-valuemax', '100');
    });

    it('aria-valuenow reflects the percentage rounded to integer', () => {
        const { getByRole } = render(<ProgressBar value={75} max={100} />);

        expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
    });

    it('aria-valuenow is a rounded percentage when max is not 100', () => {
        // value=3, max=10 → 30%
        const { getByRole } = render(<ProgressBar value={3} max={10} />);

        expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30');
    });

    it('aria-valuenow is 0 when value is 0', () => {
        const { getByRole } = render(<ProgressBar value={0} />);

        expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    });

    it('aria-valuenow is 100 when value equals max', () => {
        const { getByRole } = render(<ProgressBar value={100} />);

        expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    });

    it('clamps aria-valuenow to 0 when value is negative', () => {
        const { getByRole } = render(<ProgressBar value={-10} />);

        expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    });

    it('clamps aria-valuenow to 100 when value exceeds max', () => {
        const { getByRole } = render(<ProgressBar value={150} max={100} />);

        expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    });

    it('sets aria-label from the label prop', () => {
        const { getByRole } = render(
            <ProgressBar value={50} label="Downloading ubuntu.iso: 50%" />,
        );

        expect(getByRole('progressbar')).toHaveAttribute(
            'aria-label',
            'Downloading ubuntu.iso: 50%',
        );
    });

    it('aria-label is absent when no label prop is provided', () => {
        const { getByRole } = render(<ProgressBar value={50} />);

        expect(getByRole('progressbar')).not.toHaveAttribute('aria-label');
    });
});
