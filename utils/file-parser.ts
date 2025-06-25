import { SERVER_URL } from '@/constants/Server';

export interface ParsedFileContent {
  attachments: string[];
  cleanContent: string;
}

/**
 * Construct the API URL for file content
 */
export function getFileUrl(sandboxId: string | undefined, path: string): string {
  if (!sandboxId) return path;

  // Ensure path starts with /workspace
  if (!path.startsWith('/workspace')) {
    path = `/workspace/${path.startsWith('/') ? path.substring(1) : path}`;
  }

  // Handle any potential Unicode escape sequences
  try {
    path = path.replace(/\\u([0-9a-fA-F]{4})/g, (_, hexCode) => {
      return String.fromCharCode(parseInt(hexCode, 16));
    });
  } catch (e) {
    console.error('Error processing Unicode escapes in path:', e);
  }

  // Remove /api suffix from SERVER_URL since our endpoint structure might be different
  const baseUrl = SERVER_URL.replace('/api', '');
  const url = new URL(`${baseUrl}/sandboxes/${sandboxId}/files/content`);
  url.searchParams.append('path', path);

  return url.toString();
}

/**
 * Parse file attachments from already-cleaned message content using the pattern: [Uploaded File: /path]
 * This should be applied AFTER the main message parsing has extracted clean content
 */
export function parseFileAttachments(cleanContent: string): ParsedFileContent {
  if (!cleanContent || typeof cleanContent !== 'string') {
    return { attachments: [], cleanContent: cleanContent || '' };
  }

  // Extract file attachments using regex
  const attachmentsMatch = cleanContent.match(/\[Uploaded File: (.*?)\]/g);
  const attachments = attachmentsMatch
    ? attachmentsMatch.map(match => {
        const pathMatch = match.match(/\[Uploaded File: (.*?)\]/);
        return pathMatch ? pathMatch[1] : null;
      }).filter(Boolean) as string[]
    : [];

  // Clean message content by removing file references
  const finalCleanContent = cleanContent.replace(/\[Uploaded File: .*?\]/g, '').trim();

  return { attachments, cleanContent: finalCleanContent };
}

/**
 * File type detection based on extension
 */
export type FileType = 
  | 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'code' | 'other';

export function getFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (['txt', 'md', 'log', 'csv'].includes(ext)) return 'text';
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py'].includes(ext)) return 'code';
  
  return 'other';
}

/**
 * Generate file size estimation based on filename and type
 */
export function getEstimatedFileSize(filepath: string, type: FileType): string {
  const base = (filepath.length * 5) % 800 + 200;
  
  const multipliers: Record<FileType, number> = {
    image: 5.0,
    video: 20.0,
    audio: 10.0,
    pdf: 8.0,
    text: 0.3,
    code: 0.5,
    other: 1.0
  };
  
  const size = base * multipliers[type];
  
  if (size < 1024) return `${Math.round(size)} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
} 