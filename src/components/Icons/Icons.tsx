import React from 'react';
import type { MediaType, TrackType } from '../../types/editor';

export interface IconProps {
  size?: number;
  className?: string;
}

const baseProps = (size: number, className?: string): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.85,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className,
  'aria-hidden': true,
  style: { flexShrink: 0, display: 'inline-block' },
});

export const FilmIcon: React.FC<IconProps> = ({ size = 15, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="2" y="3" width="20" height="18" rx="2.5" />
    <line x1="7" y1="3" x2="7" y2="21" />
    <line x1="17" y1="3" x2="17" y2="21" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="2" y1="7.5" x2="7" y2="7.5" />
    <line x1="2" y1="16.5" x2="7" y2="16.5" />
    <line x1="17" y1="7.5" x2="22" y2="7.5" />
    <line x1="17" y1="16.5" x2="22" y2="16.5" />
  </svg>
);

export const AudioIcon: React.FC<IconProps> = ({ size = 15, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

export const ImageIcon: React.FC<IconProps> = ({ size = 15, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

export const TextIcon: React.FC<IconProps> = ({ size = 15, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <line x1="7" y1="13" x2="13" y2="13" />
    <line x1="7" y1="16" x2="17" y2="16" />
  </svg>
);

export const SaveIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...baseProps(size, className)}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const UndoIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
);

export const RedoIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
  </svg>
);

export const PlayIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...baseProps(size, className)} fill="currentColor">
    <polygon points="6 4 20 12 6 20 6 4" />
  </svg>
);

export const PauseIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...baseProps(size, className)} fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

export const StopIcon: React.FC<IconProps> = ({ size = 13, className }) => (
  <svg {...baseProps(size, className)} fill="currentColor">
    <rect x="5" y="5" width="14" height="14" rx="2" />
  </svg>
);

export const MagnetIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M6 15V6a2 2 0 0 1 2-2h1v4H8v7a4 4 0 0 0 8 0V8h-1V4h1a2 2 0 0 1 2 2v9a6 6 0 0 1-12 0z" />
    <line x1="6" y1="9" x2="9" y2="9" />
    <line x1="15" y1="9" x2="18" y2="9" />
  </svg>
);

export const DownloadIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const VolumeOnIcon: React.FC<IconProps> = ({ size = 13, className }) => (
  <svg {...baseProps(size, className)}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

export const VolumeOffIcon: React.FC<IconProps> = ({ size = 13, className }) => (
  <svg {...baseProps(size, className)}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

export const LockIcon: React.FC<IconProps> = ({ size = 13, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const UnlockIcon: React.FC<IconProps> = ({ size = 13, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 7.75-1.5" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 12, className }) => (
  <svg {...baseProps(size, className)}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const FolderIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export const UploadIcon: React.FC<IconProps> = ({ size = 28, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...baseProps(size, className)}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 13, className }) => (
  <svg {...baseProps(size, className)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const MinusIcon: React.FC<IconProps> = ({ size = 13, className }) => (
  <svg {...baseProps(size, className)}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const MediaTypeIcon: React.FC<{
  type: MediaType | TrackType;
  size?: number;
  className?: string;
}> = ({ type, size = 14, className }) => {
  switch (type) {
    case 'video':
      return <FilmIcon size={size} className={className} />;
    case 'audio':
      return <AudioIcon size={size} className={className} />;
    case 'image':
      return <ImageIcon size={size} className={className} />;
    case 'text':
    case 'overlay':
      return <TextIcon size={size} className={className} />;
    default:
      return <FilmIcon size={size} className={className} />;
  }
};
