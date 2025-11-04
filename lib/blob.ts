import { put, del } from '@vercel/blob';

export async function uploadImage(file: File): Promise<string> {
  const blob = await put(file.name, file, {
    access: 'public',
  });
  return blob.url;
}

export async function uploadImageFromUrl(url: string, filename: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  const file = new File([blob], filename, { type: blob.type });
  return uploadImage(file);
}

export async function deleteImage(url: string): Promise<void> {
  try {
    await del(url);
  } catch (error) {
    console.error('Error deleting image:', error);
  }
}
