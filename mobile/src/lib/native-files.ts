import { t } from './i18n';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { client } from './api';

export async function pickImage() {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error(t("Aucune image sélectionnée."));
  if (asset.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)) {
    throw new Error(t("Choisissez une image JPEG, PNG ou WebP."));
  }
  const file = new File(asset.uri);
  if (file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error(t("L’image doit faire entre 1 octet et 5 Mo."));
  const form = new FormData();
  form.append('file', file, asset.fileName ?? 'photo.jpg');
  return form;
}

export async function sharePdf(path: string, name: string) {
  if (!await Sharing.isAvailableAsync()) throw new Error(t("Le partage de fichiers n’est pas disponible sur cet appareil."));
  const response = await client().response(path);
  if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error(t("Le serveur n’a pas retourné un PDF."));
  const file = new File(Paths.cache, `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.pdf`);
  try {
    file.create();
    await file.write(new Uint8Array(await response.arrayBuffer()));
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t("Partager le bulletin SAIWAY") });
  } finally { if (file.exists) file.delete(); }
}
