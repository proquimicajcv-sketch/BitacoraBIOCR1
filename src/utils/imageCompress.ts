/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Client-side lightweight image compression
 * Ensures field photos taken on high-resolution cameras/phones (3MB-15MB)
 * are smoothly optimized to ~80-120KB JPEGs that EASILY fit into Google Cloud
 * Firestore's 1MB per-document limit without losing visual fidelity.
 */
export async function compressDataUrl(
  dataUrl: string,
  maxDimension = 1200,
  quality = 0.8
): Promise<string> {
  if (typeof window === 'undefined' || !dataUrl || !dataUrl.startsWith('data:image')) {
    return dataUrl;
  }

  // If already lightweight (< 140KB string length), keep as-is
  if (dataUrl.length < 140000) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
