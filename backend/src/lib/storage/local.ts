import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env';
import type { StorageProvider, StoredFile } from './types';

function uploadRoot(): string {
  return path.isAbsolute(env.LOCAL_UPLOAD_DIR)
    ? env.LOCAL_UPLOAD_DIR
    : path.resolve(process.cwd(), env.LOCAL_UPLOAD_DIR);
}

export class LocalStorageProvider implements StorageProvider {
  async save(objectKey: string, data: Buffer, _contentType: string): Promise<StoredFile> {
    const safeKey = objectKey.replace(/\\/g, '/').replace(/\.\./g, '');
    const fullPath = path.join(uploadRoot(), safeKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    const url = `/uploads/${safeKey.split('/').map(encodeURIComponent).join('/')}`;
    return { url, key: safeKey };
  }

  async deleteByKey(objectKey: string): Promise<void> {
    const safeKey = objectKey.replace(/\\/g, '/').replace(/\.\./g, '');
    const fullPath = path.join(uploadRoot(), safeKey);
    await fs.unlink(fullPath).catch(() => undefined);
  }
}
