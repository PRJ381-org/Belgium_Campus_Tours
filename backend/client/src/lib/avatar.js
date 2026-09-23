/**
 * Profile picture helpers: load an image, export a crop, and talk to the avatar API.
 */
import { fetchJson } from './api.js';

export const AVATAR_SIZE = 256;
// Must stay under the backend's limit (see AVATAR_MAX_LENGTH in auth.routes.js).
const MAX_LENGTH = 90000;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be read.'));
    img.src = src;
  });
}

/**
 * Reads a chosen file into an <img>. Uses a data: URL rather than
 * URL.createObjectURL - the server's CSP (img-src 'self' data:) blocks blob: images.
 */
export async function loadImageFile(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.readAsDataURL(file);
  });
  return loadImage(src);
}

export { loadImage };

/**
 * Renders the visible part of the photo editor into a 256x256 JPEG data URL.
 * `crop` describes where the image sits inside a square viewport of `viewSize`
 * pixels: its displayed width/height and its top-left corner (x, y).
 */
export function exportCrop(img, { viewSize, x, y, width, height }) {
  const scale = AVATAR_SIZE / viewSize;
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // JPEG has no transparency
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, x * scale, y * scale, width * scale, height * scale);

  for (const quality of [0.88, 0.75, 0.6, 0.45]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_LENGTH) return dataUrl;
  }
  throw new Error('That image is too detailed to upload. Try a different one.');
}

export async function fetchAvatar() {
  const res = await fetchJson('/api/auth/me/avatar');
  return res.avatar || '';
}

export async function saveAvatar(dataUrl) {
  const res = await fetchJson('/api/auth/me/avatar', {
    method: 'PUT',
    body: JSON.stringify({ avatar: dataUrl }),
  });
  return res.avatar;
}

export async function removeAvatar() {
  await fetchJson('/api/auth/me/avatar', { method: 'DELETE' });
  return '';
}
