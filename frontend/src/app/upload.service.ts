import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gtntitfbnvaokkyvgffv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0bnRpdGZibnZhb2treXZnZmZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjEzNjcsImV4cCI6MjA4NTg5NzM2N30.dK0g7_FjgHPCuivzaRjSpZeb-QFuHd7ccGyOZLuUCMk';
const BUCKET = 'wildlife-photos';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async uploadPhoto(file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${crypto.randomUUID()}.${ext}`;

    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(filename, file, { contentType: file.type, upsert: false });

    if (error) throw new Error('Photo upload failed: ' + error.message);

    const { data } = this.supabase.storage.from(BUCKET).getPublicUrl(filename);
    return data.publicUrl;
  }
}
