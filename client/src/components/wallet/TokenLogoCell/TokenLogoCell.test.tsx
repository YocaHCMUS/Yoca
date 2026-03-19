// @vitest-environment jsdom
/**
 * Tests for TokenLogoCell component
 *
 * Covers:
 *  - renders img when valid logoUri is provided
 *  - falls back to initials badge when logoUri is absent
 *  - falls back to initials badge on img load error
 *  - alt text is accessible
 *  - label text is always rendered
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { TokenLogoCell } from './TokenLogoCell';
import { describe, expect, it } from 'vitest';

describe('TokenLogoCell', () => {
    it('renders the label text', () => {
        render(<TokenLogoCell label="SOL" />);
        expect(screen.getByText('SOL')).toBeInTheDocument();
    });

    it('renders an <img> when logoUri is provided', () => {
        render(<TokenLogoCell label="SOL" logoUri="https://cdn.example.com/sol.png" />);
        const img = screen.getByRole('img', { name: 'SOL' });
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://cdn.example.com/sol.png');
        expect(img).toHaveAttribute('alt', 'SOL');
    });

    it('shows initials badge instead of img when logoUri is absent', () => {
        render(<TokenLogoCell label="SOL" />);
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        // Initials badge is aria-hidden; look for it by text content
        const badge = document.querySelector('[aria-hidden="true"]');
        expect(badge?.textContent).toBe('SO');
    });

    it('falls back to initials badge when the image fails to load', () => {
        render(<TokenLogoCell label="SOL" logoUri="https://bad.example.com/broken.png" />);
        const img = screen.getByRole('img', { name: 'SOL' });
        // Simulate broken image
        fireEvent.error(img);
        // After error the img should be replaced by the initials badge
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        const badge = document.querySelector('[aria-hidden="true"]');
        expect(badge).toBeInTheDocument();
    });

    it('initials are derived from first two letters of the label', () => {
        render(<TokenLogoCell label="USDC" />);
        const badge = document.querySelector('[aria-hidden="true"]');
        expect(badge?.textContent).toBe('US');
    });

    it('uses fallback "?" initials for a label with no alpha characters', () => {
        render(<TokenLogoCell label="123" />);
        const badge = document.querySelector('[aria-hidden="true"]');
        expect(badge?.textContent).toBe('?');
    });

    it('label text is always rendered even when logoUri is valid', () => {
        render(<TokenLogoCell label="SOL" logoUri="https://cdn.example.com/sol.png" />);
        expect(screen.getByText('SOL')).toBeInTheDocument();
    });

    it('img is absent (not rendered) when logoUri is undefined', () => {
        render(<TokenLogoCell label="Unknown" logoUri={undefined} />);
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
});
