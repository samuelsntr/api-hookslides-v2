import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const MAX_PIXELS = 16_000_000;

export function createLogoStorage({ uploadsPath }) {
  const logoDirectory = path.join(uploadsPath, 'brand-logos');

  async function ensureReady() {
    await fs.mkdir(logoDirectory, { recursive: true });
    await fs.access(logoDirectory, fs.constants.W_OK);
  }

  return {
    ensureReady,
    async normalize(buffer, assetId) {
      const image = sharp(buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS });
      const metadata = await image.metadata();
      if (!['png', 'jpeg', 'webp'].includes(metadata.format) || !metadata.width || !metadata.height) {
        throw new Error('UNSUPPORTED_IMAGE');
      }
      if (metadata.width > 4096 || metadata.height > 4096 || metadata.width * metadata.height > MAX_PIXELS) {
        throw new Error('IMAGE_DIMENSIONS_TOO_LARGE');
      }
      const relativePath = path.posix.join('brand-logos', `${assetId}.webp`);
      const destination = path.join(uploadsPath, relativePath);
      const temporary = `${destination}.tmp`;
      const output = await image.rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 88, smartSubsample: true }).toBuffer({ resolveWithObject: true });
      await fs.writeFile(temporary, output.data, { flag: 'wx' });
      await fs.rename(temporary, destination);
      return { relativePath, mimeType: 'image/webp', width: output.info.width, height: output.info.height, byteSize: output.info.size };
    },
    resolve(relativePath) {
      const absolute = path.resolve(uploadsPath, relativePath);
      if (!absolute.startsWith(`${path.resolve(uploadsPath)}${path.sep}`)) throw new Error('INVALID_ASSET_PATH');
      return absolute;
    },
    async remove(relativePath) {
      try { await fs.unlink(this.resolve(relativePath)); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    },
  };
}
