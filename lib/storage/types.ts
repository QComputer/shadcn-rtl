export type ApplicationStorageProvider = "vercel-blob" | "local-test";

export type ApplicationStorageAccess = "public" | "private";

export type StoredApplicationAsset = {
  provider: ApplicationStorageProvider;
  organizationId: string;
  key: string;
  url: string;
  access: ApplicationStorageAccess;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  width: number | null;
  height: number | null;
};

export type StoreApplicationAssetInput = {
  organizationId: string;
  buffer: Buffer;
  mimeType: string;
  purpose: string;
  access?: ApplicationStorageAccess;
  sourceUrl?: string | null;
};

export type RemoveApplicationAssetInput = {
  organizationId: string;
  key: string;
};

export type ApplicationStorageAdapter = {
  provider: ApplicationStorageProvider;
  store(input: StoreApplicationAssetInput & { key: string; checksumSha256: string; width: number | null; height: number | null }): Promise<StoredApplicationAsset>;
  remove(input: RemoveApplicationAssetInput): Promise<void>;
  verify?(input: RemoveApplicationAssetInput): Promise<boolean>;
  streamContent?(input: { organizationId: string; key: string; mimeType: string }): Promise<ReadableStream<Uint8Array> | null>;
};
