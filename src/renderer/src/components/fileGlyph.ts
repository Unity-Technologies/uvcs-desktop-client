import {
  FileArchive,
  FileBox,
  FileBraces,
  FileCode,
  FileCog,
  FileDigit,
  FileImage,
  FilePlay,
  FileTerminal,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import type { FileFamily } from './fileFamily';

/** Each family's glyph on the page (Lucide's), `null` for the plain page: generated files and unknown types. */
export const FAMILY_GLYPHS: Record<FileFamily, LucideIcon | null> = {
  source: FileCode,
  script: FileTerminal,
  project: FileCog,
  config: FileBraces,
  generated: null,
  docs: FileText,
  image: FileImage,
  media: FilePlay,
  asset: FileBox,
  archive: FileArchive,
  binary: FileDigit,
  plain: null,
};
