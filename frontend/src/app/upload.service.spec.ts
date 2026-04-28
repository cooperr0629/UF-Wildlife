import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { UploadService } from './upload.service';

// ── Storage stubs ────────────────────────────────────────────────────────────
let lastUploadArgs: { filename: string; file: File; opts: any } | null = null;
let uploadResult: { error: { message: string } | null } = { error: null };
let publicUrlResult = { data: { publicUrl: 'https://cdn.example.com/photo.jpg' } };

const storageBucketStub = {
  upload: vi.fn(async (filename: string, file: File, opts: any) => {
    lastUploadArgs = { filename, file, opts };
    return uploadResult;
  }),
  getPublicUrl: vi.fn(() => publicUrlResult),
};

// Replace the Supabase client builder so the service uses our stub
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: { from: () => storageBucketStub },
  }),
}));

describe('UploadService', () => {
  let service: UploadService;

  beforeEach(() => {
    lastUploadArgs = null;
    uploadResult = { error: null };
    publicUrlResult = { data: { publicUrl: 'https://cdn.example.com/photo.jpg' } };
    storageBucketStub.upload.mockClear();
    storageBucketStub.getPublicUrl.mockClear();

    // crypto.randomUUID may not exist in all jsdom builds; stub it for stability
    if (!('randomUUID' in (globalThis.crypto ?? {}))) {
      (globalThis as any).crypto = { ...(globalThis.crypto ?? {}), randomUUID: () => 'uuid-fixed' };
    } else {
      vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
        'uuid-fixed-0000-0000-0000-000000000000'
      );
    }

    TestBed.configureTestingModule({});
    service = TestBed.inject(UploadService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── uploadPhoto() ────────────────────────────────────────────────────────

  it('uploadPhoto() uploads with a uuid-based filename preserving the extension', async () => {
    const file = new File(['data'], 'sunset.jpeg', { type: 'image/jpeg' });
    await service.uploadPhoto(file);
    expect(storageBucketStub.upload).toHaveBeenCalledTimes(1);
    expect(lastUploadArgs?.filename).toMatch(/\.jpeg$/);
    expect(lastUploadArgs?.opts.contentType).toBe('image/jpeg');
    expect(lastUploadArgs?.opts.upsert).toBe(false);
  });

  it('uploadPhoto() falls back to "jpg" when the filename is empty', async () => {
    const file = new File(['data'], '', { type: 'image/jpeg' });
    await service.uploadPhoto(file);
    expect(lastUploadArgs?.filename).toMatch(/\.jpg$/);
  });

  it('uploadPhoto() returns the public URL on success', async () => {
    publicUrlResult = { data: { publicUrl: 'https://cdn.example.com/uuid.jpeg' } };
    const file = new File(['data'], 'a.jpeg', { type: 'image/jpeg' });
    const url = await service.uploadPhoto(file);
    expect(url).toBe('https://cdn.example.com/uuid.jpeg');
  });

  it('uploadPhoto() throws with a descriptive message when upload fails', async () => {
    uploadResult = { error: { message: 'bucket not found' } };
    const file = new File(['data'], 'x.png', { type: 'image/png' });
    await expect(service.uploadPhoto(file)).rejects.toThrow(
      /Photo upload failed: bucket not found/
    );
  });
});
