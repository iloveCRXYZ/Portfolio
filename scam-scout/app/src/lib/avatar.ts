import * as ImagePicker from 'expo-image-picker';
import { api } from './api';
import type { Me } from './types';

export const AVATAR_COLORS = ['#2F5BEA', '#1B7F4F', '#C9650C', '#8B5CF6', '#C93434', '#0E7490'];

/** Opens the photo library and uploads a square crop. Returns null if the player cancels. */
export async function pickAndUploadAvatar(): Promise<Me | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Allow photo access in Settings to pick a profile picture.');
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true });
  if (res.canceled || !res.assets[0]?.base64) return null;
  const a = res.assets[0];
  const type = a.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  return api<Me>('/me/avatar', { method: 'PUT', body: { image: `data:${type};base64,${a.base64}` } });
}

export const setAvatarColor = (color: string) => api<Me>('/me/avatar', { method: 'PUT', body: { color } });
export const removeAvatar = () => api<Me>('/me/avatar', { method: 'DELETE' });
