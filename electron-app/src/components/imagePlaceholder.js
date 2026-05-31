const PLACEHOLDER_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 540">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1f2937"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#facc15"/>
    </linearGradient>
  </defs>
  <rect width="900" height="540" rx="36" fill="url(#bg)"/>
  <circle cx="170" cy="135" r="92" fill="rgba(56,189,248,0.14)"/>
  <circle cx="730" cy="400" r="120" fill="rgba(250,204,21,0.10)"/>
  <rect x="240" y="118" width="420" height="250" rx="28" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" stroke-width="6"/>
  <path d="M300 300l90-110 70 80 70-55 110 85" fill="none" stroke="url(#accent)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="360" cy="210" r="24" fill="#38bdf8"/>
  <text x="450" y="445" fill="rgba(255,255,255,0.84)" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="34" font-weight="700" text-anchor="middle">No image set</text>
  <text x="450" y="486" fill="rgba(148,163,184,0.92)" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="22" text-anchor="middle">Drop a file path or URL to show artwork here</text>
</svg>`);

export const PLACEHOLDER_IMAGE = `data:image/svg+xml;charset=UTF-8,${PLACEHOLDER_SVG}`;

/**
 * Resolve a media path for use in <img src> or <audio src>.
 * - http(s):// and data: URLs pass through unchanged
 * - Absolute filesystem paths (/home/...) get local-file:// prefix
 * - Relative paths pass through unchanged
 * - Handles spaces, accented chars (ő, ű, á, é, ó, etc.)
 */
export function resolveMediaPath(rawPath) {
  if (!rawPath) return '';
  // Already a URL with protocol — pass through
  if (/^(https?:|data:|file:|blob:|local-file:)/i.test(rawPath)) return rawPath;
  // Absolute Unix path — convert to local-file:// URL
  if (rawPath.startsWith('/')) {
    return `local-file://${rawPath}`;
  }
  // Relative path — pass through
  return rawPath;
}
