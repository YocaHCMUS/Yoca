/**
 * TokenLogoCell
 *
 * Renders a token identity cell with an optional logo image and a text label.
 * - Shows <img> when logoUri is provided and the image loads successfully.
 * - Falls back to a two-letter initials badge when logoUri is absent or fails.
 * - Accessible: img carries descriptive alt text; the initials badge is aria-hidden.
 *
 * @module components/wallet/TokenLogoCell
 */

import React, { useState } from 'react';

interface TokenLogoCellProps {
    /** Resolved display label (symbol, name, shortened address, or "Unknown") */
    label: string;
    /** Logo image URL.  May be undefined when metadata enrichment was absent. */
    logoUri?: string;
}

const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
};

const imgStyle: React.CSSProperties = {
    width: 20,
    height: 20,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
};

const initialsStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: 'var(--cds-layer-accent, #393939)',
    color: 'var(--cds-text-inverse, #ffffff)',
    fontSize: 9,
    fontWeight: 600,
    flexShrink: 0,
    userSelect: 'none',
};

/**
 * TokenLogoCell renders a logo + label pair inside a table cell.
 *
 * Usage:
 *   <TokenLogoCell label="SOL" logoUri="https://cdn.example.com/sol.png" />
 */
export function TokenLogoCell({ label, logoUri }: TokenLogoCellProps): React.ReactElement {
    const [imgFailed, setImgFailed] = useState(false);
    const showImage = Boolean(logoUri) && !imgFailed;
    // Build two-letter initials from the first two alpha characters of the label
    const initials = label.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || '?';

    return (
        <span style={containerStyle}>
            {showImage ? (
                <img
                    src={logoUri}
                    alt={label}
                    style={imgStyle}
                    width={20}
                    height={20}
                    onError={() => setImgFailed(true)}
                />
            ) : (
                <span style={initialsStyle} aria-hidden="true">
                    {initials}
                </span>
            )}
            <span>{label}</span>
        </span>
    );
}

export default TokenLogoCell;
