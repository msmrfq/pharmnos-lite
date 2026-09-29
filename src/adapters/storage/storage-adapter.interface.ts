export type StorageObject = {
  key: string;
  bucket: string;
  size?: number;
  mimetype?: string;
  lastModified?: Date;
  url?: string;
};

export type StorageUploadResult = {
  key: string;
  url?: string;
  etag?: string;
};

export type SignedUrlOptions = {
  expiresInSeconds: number;
  download?: boolean;
};

export interface IStorageAdapter {
  upload(
    bucket: string,
    key: string,
    data: Buffer | ReadableStream<Uint8Array> | File | Blob,
    mimetype?: string,
  ): Promise<StorageUploadResult>;
  download(bucket: string, key: string): Promise<Buffer>;
  getPublicUrl(bucket: string, key: string): string;
  getSignedUrl(bucket: string, key: string, options: SignedUrlOptions): Promise<string>;
  delete(bucket: string, key: string): Promise<void>;
  list(bucket: string, prefix?: string): Promise<StorageObject[]>;
  ensureBucket(bucket: string, isPublic?: boolean): Promise<void>;
}
