interface DownloadableFormat {
  url?: string;
  cipher?: string;
  signature_cipher?: string;
}

/** Skip metadata-only formats and continue if an individual signature fails. */
export async function firstFormatUrl<T extends DownloadableFormat>(
  formats: T[],
  decipher: (format: T) => Promise<string>,
  usable: (url: string) => Promise<boolean> = async () => true,
): Promise<string | undefined> {
  for (const format of formats) {
    if (!format.url && !format.cipher && !format.signature_cipher) continue;
    try {
      const url = await decipher(format);
      if (url && await usable(url)) return url;
    } catch {
      // Other formats can have usable URLs even when this signature fails.
    }
  }
  return undefined;
}
