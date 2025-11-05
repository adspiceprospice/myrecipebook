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

export async function uploadBase64Image(base64Data: string, filename: string): Promise<string> {
  // Handle both data URLs and raw base64
  const base64String = base64Data.includes('base64,')
    ? base64Data.split('base64,')[1]
    : base64Data;

  // Convert base64 to buffer
  const buffer = Buffer.from(base64String, 'base64');

  // Upload to Vercel Blob
  const blob = await put(filename, buffer, {
    access: 'public',
    contentType: 'image/png',
  });

  return blob.url;
}

export async function deleteImage(url: string): Promise<void> {
  try {
    await del(url);
  } catch (error) {
    console.error('Error deleting image:', error);
  }
}
