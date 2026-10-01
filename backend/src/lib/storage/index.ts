import { env } from '../../config/env';
import { HttpError } from '../errors';
import { LocalStorageProvider } from './local';
import type { StorageProvider } from './types';

let provider: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (provider) {
    return provider;
  }
  if (env.STORAGE_PROVIDER === 'local') {
    provider = new LocalStorageProvider();
    return provider;
  }
  throw new HttpError(
    501,
    'STORAGE_NOT_CONFIGURED',
    `${env.STORAGE_PROVIDER} storage is not implemented yet. Use STORAGE_PROVIDER=local in development.`,
  );
}
