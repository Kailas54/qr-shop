export type StoredFile = {
  url: string;
  key: string;
};

export interface StorageProvider {
  save(objectKey: string, data: Buffer, contentType: string): Promise<StoredFile>;
  deleteByKey(objectKey: string): Promise<void>;
}
