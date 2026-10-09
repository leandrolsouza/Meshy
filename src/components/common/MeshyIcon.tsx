import type { JSX, ReactNode } from 'react';

type MeshyIconName =
    'downloads' | 'search' | 'add-torrent' | 'settings' | 'import-torrent' | 'empty-downloads';

interface MeshyIconProps {
    name: MeshyIconName;
    size?: number;
    className?: string | undefined;
}

const drawings: Record<MeshyIconName, ReactNode> = {
    downloads: (
        <>
            <path d="M12 3v11m-4-4 4 4 4-4M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" />
            <circle cx="4" cy="11" r="1" fill="currentColor" stroke="none" />
            <circle cx="20" cy="11" r="1" fill="currentColor" stroke="none" />
        </>
    ),
    search: (
        <>
            <circle cx="10" cy="10" r="6" />
            <path d="m14.5 14.5 5.5 5.5M7.5 8.5h5M7.5 11.5h3" />
        </>
    ),
    'add-torrent': (
        <>
            <path d="M12 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l5 5v3M14 3v5h5M8 12h3M8 16h2M17 14v7m-3.5-3.5h7" />
        </>
    ),
    settings: (
        <>
            <path d="M3 6h3m4 0h11M3 12h11m4 0h3M3 18h3m4 0h11" />
            <circle cx="8" cy="6" r="2" />
            <circle cx="16" cy="12" r="2" />
            <circle cx="8" cy="18" r="2" />
        </>
    ),
    'import-torrent': (
        <>
            <path d="M7 3h7l5 5v5M14 3v5h5M7 3a2 2 0 0 0-2 2v5M12 10v8m-3-3 3 3 3-3M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
        </>
    ),
    'empty-downloads': (
        <>
            <g opacity="0.3">
                <path d="m19 20 20-8 38 13 8 32-15 22-43 5L11 57l8-37M19 20l8 64M11 57l28-45m38 13L70 79" />
                <circle cx="19" cy="20" r="3" fill="currentColor" stroke="none" />
                <circle cx="39" cy="12" r="3" fill="currentColor" stroke="none" />
                <circle cx="77" cy="25" r="3" fill="currentColor" stroke="none" />
                <circle cx="85" cy="57" r="3" fill="currentColor" stroke="none" />
                <circle cx="70" cy="79" r="3" fill="currentColor" stroke="none" />
                <circle cx="27" cy="84" r="3" fill="currentColor" stroke="none" />
                <circle cx="11" cy="57" r="3" fill="currentColor" stroke="none" />
            </g>
            <rect
                x="25"
                y="27"
                width="46"
                height="46"
                rx="14"
                fill="var(--color-bg)"
                stroke="none"
            />
            <path
                d="M48 32v23m-8-8 8 8 8-8M31 58v6a5 5 0 0 0 5 5h24a5 5 0 0 0 5-5v-6"
                strokeWidth="2.5"
            />
        </>
    ),
};

/** Ícones decorativos; o controle que os contém fornece o nome acessível. */
export function MeshyIcon({ name, size = 18, className }: MeshyIconProps): JSX.Element {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox={name === 'empty-downloads' ? '0 0 96 96' : '0 0 24 24'}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {drawings[name]}
        </svg>
    );
}
