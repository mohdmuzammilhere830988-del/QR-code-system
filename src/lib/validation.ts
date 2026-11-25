export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateExternalImageUrl(rawUrl: string): { valid: boolean; error?: string; normalized?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'Please enter an image URL.' };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Only public http:// or https:// image URLs are allowed.',
      };
    }
    if (!parsed.hostname || parsed.hostname.length < 3) {
      return { valid: false, error: 'Please enter a valid domain name in the URL.' };
    }
    return { valid: true, normalized: parsed.toString() };
  } catch {
    return { valid: false, error: 'Invalid URL format. Include https:// at the beginning.' };
  }
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const lowerName = file.name.toLowerCase();
  const validExt =
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.webp');

  const validMime =
    ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]) ||
    (file.type === '' && validExt);

  if (!validMime || !validExt) {
    return {
      valid: false,
      error: 'Unsupported file format. Please upload a JPG, JPEG, PNG, or WEBP image.',
    };
  }

  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Image exceeds the 5 MB size limit. Please choose a smaller file.',
    };
  }

  return { valid: true };
}

export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (slug.length < 2 || slug.length > 80) {
    return { valid: false, error: 'Slug must be between 2 and 80 characters.' };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      valid: false,
      error: 'Slug can only contain lowercase letters, numbers, and single hyphens.',
    };
  }
  return { valid: true };
}

export function sanitizeSafeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}
