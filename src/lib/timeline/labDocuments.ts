'use client';

import { createClient } from '@/lib/supabase/client';
import type { Database, LabDocument } from '@/types/database';

const LAB_DOCUMENTS_BUCKET = 'lab-documents';
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

type LabDocumentInsert = Database['public']['Tables']['lab_documents']['Insert'];
type LabDocumentUpdate = Database['public']['Tables']['lab_documents']['Update'];

export type UploadLabDocumentMetadata = {
  name: string;
  lab_date?: string | null;
  specialty?: string | null;
  notes?: string | null;
};

export type UpdateLabDocumentInput = Omit<
  LabDocumentUpdate,
  'id' | 'user_id' | 'storage_path' | 'created_at' | 'updated_at'
>;

async function getCurrentUserId() {
  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error('You must be signed in to manage lab documents.');
  }

  return user.id;
}

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase();

  return cleaned || 'lab-document';
}

function assertAllowedFile(file: File) {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only PDF, JPEG, PNG, and WEBP files are supported.');
  }
}

export async function getLabDocuments(): Promise<LabDocument[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('lab_documents')
    .select('*')
    .order('lab_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getLabDocumentById(
  id: string,
): Promise<LabDocument | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('lab_documents')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function getLabDocumentsByIds(
  ids: string[],
): Promise<LabDocument[]> {
  const supabase = createClient();

  if (!ids.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('lab_documents')
    .select('*')
    .in('id', ids)
    .order('lab_date', { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function uploadLabDocument(
  file: File,
  metadata: UploadLabDocumentMetadata,
): Promise<LabDocument> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  assertAllowedFile(file);

  if (!metadata.name.trim()) {
    throw new Error('Lab document name is required.');
  }

  const labDocumentId = crypto.randomUUID();
  const safeFileName = sanitizeFileName(file.name);
  const storagePath = `${userId}/${labDocumentId}/${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from(LAB_DOCUMENTS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const payload: LabDocumentInsert = {
    id: labDocumentId,
    user_id: userId,
    name: metadata.name.trim(),
    lab_date: metadata.lab_date ?? null,
    specialty: metadata.specialty?.trim() || null,
    storage_path: storagePath,
    file_name: file.name,
    file_size: file.size,
    file_type: file.type,
    notes: metadata.notes?.trim() || null,
  };

  const { data, error: insertError } = await supabase
    .from('lab_documents')
    .insert(payload)
    .select('*')
    .single();

  if (insertError) {
    await supabase.storage.from(LAB_DOCUMENTS_BUCKET).remove([storagePath]);
    throw new Error(insertError.message);
  }

  return data;
}

export async function updateLabDocument(
  id: string,
  input: UpdateLabDocumentInput,
): Promise<LabDocument> {
  const supabase = createClient();

  const payload: LabDocumentUpdate = {
    ...input,
    name: typeof input.name === 'string' ? input.name.trim() : input.name,
    specialty:
      typeof input.specialty === 'string'
        ? input.specialty.trim() || null
        : input.specialty,
    notes:
      typeof input.notes === 'string' ? input.notes.trim() || null : input.notes,
  };

  const { data, error } = await supabase
    .from('lab_documents')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createSignedLabUrl(
  storagePath: string,
  expiresIn = SIGNED_URL_EXPIRY_SECONDS,
): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from(LAB_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}

export async function downloadLabDocument(
  labDocument: Pick<LabDocument, 'storage_path' | 'file_name'>,
): Promise<void> {
  const signedUrl = await createSignedLabUrl(labDocument.storage_path);

  const link = document.createElement('a');
  link.href = signedUrl;
  link.download = labDocument.file_name || 'lab-document';
  link.target = '_blank';
  link.rel = 'noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function deleteLabDocument(id: string): Promise<void> {
  const supabase = createClient();

  const { data: labDocument, error: fetchError } = await supabase
    .from('lab_documents')
    .select('storage_path')
    .eq('id', id)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const { error: storageError } = await supabase.storage
    .from(LAB_DOCUMENTS_BUCKET)
    .remove([labDocument.storage_path]);

  if (storageError) {
    throw new Error(storageError.message);
  }

  const { error: deleteError } = await supabase
    .from('lab_documents')
    .delete()
    .eq('id', id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}
