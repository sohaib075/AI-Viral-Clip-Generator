import * as DocumentPicker from 'expo-document-picker';

export interface PickedVideo {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
  // Only on web, where the picker returns a real File
  file?: File;
}

export async function pickVideo(): Promise<PickedVideo | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name || 'video.mp4',
    mimeType: asset.mimeType || 'video/mp4',
    size: asset.size ?? null,
    file: asset.file,
  };
}

export function videoFormData(video: PickedVideo, fields: Record<string, string>) {
  const form = new FormData();
  if (video.file) {
    form.append('video', video.file);
  } else {
    // React Native's FormData accepts { uri, name, type } objects for files
    form.append('video', { uri: video.uri, name: video.name, type: video.mimeType } as unknown as Blob);
  }
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
}
