import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  IStorageAdapter,
  StorageObject,
  StorageUploadResult,
  SignedUrlOptions,
} from "./storage-adapter.interface";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function assertConfigured(): void {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error(
      "Supabase storage requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
}

function createClientRw(): SupabaseClient {
  assertConfigured();
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class SupabaseStorageAdapter implements IStorageAdapter {
  private get client() {
    return createClientRw();
  }

  async ensureBucket(bucket: string, isPublic = false): Promise<void> {
    const sb = this.client;
    const { data: list } = await sb.storage.listBuckets();
    const exists = list?.some((b) => b.name === bucket);
    if (!exists) {
      const { error } = await sb.storage.createBucket(bucket, { public: isPublic });
      if (error) throw error;
    } else if (isPublic) {
      sb.storage.from(bucket).getPublicUrl("__probe__");
    }
  }

  async upload(
    bucket: string,
    key: string,
    body: Buffer | ReadableStream<Uint8Array> | File | Blob,
    mimetype?: string,
  ): Promise<StorageUploadResult> {
    const sb = this.client;
    const uploadBody = body as unknown as File | Blob | ArrayBuffer | Uint8Array;
    const { data, error } = await sb.storage.from(bucket).upload(key, uploadBody, {
      contentType: mimetype,
      upsert: true,
    });
    if (error) throw error;
    return {
      key: data ? (data as { path: string }).path : key,
    };
  }

  async download(bucket: string, key: string): Promise<Buffer> {
    const sb = this.client;
    const { data, error } = await sb.storage.from(bucket).download(key);
    if (error || !data) throw error ?? new Error("Download returned no data.");
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  }

  getPublicUrl(bucket: string, key: string): string {
    const sb = this.client;
    const { data } = sb.storage.from(bucket).getPublicUrl(key);
    return data.publicUrl;
  }

  async getSignedUrl(bucket: string, key: string, options: SignedUrlOptions): Promise<string> {
    const sb = this.client;
    const { data, error } = await sb.storage.from(bucket).createSignedUrl(key, options.expiresInSeconds, {
      download: options.download,
    });
    if (error || !data) throw error ?? new Error("Failed to create signed URL.");
    return data.signedUrl;
  }

  async delete(bucket: string, key: string): Promise<void> {
    const sb = this.client;
    const { error } = await sb.storage.from(bucket).remove([key]);
    if (error) throw error;
  }

  async list(bucket: string, prefix = ""): Promise<StorageObject[]> {
    const sb = this.client;
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw error;
    return (data ?? []).map((f) => ({
      key: `${prefix ? prefix + "/" : ""}${f.name}`,
      bucket,
      size: f.metadata?.size as number | undefined,
      mimetype: f.metadata?.mimetype as string | undefined,
      lastModified: f.updated_at ? new Date(f.updated_at) : undefined,
    }));
  }
}

export const storageAdapter: IStorageAdapter = new SupabaseStorageAdapter();
