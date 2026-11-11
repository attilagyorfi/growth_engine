/**
 * Szerveren készült fájl letöltése a böngészőben (a tRPC base64-ben adja vissza).
 * A riport Word- és PDF-exportja is ezt használja (Reports.tsx).
 */
export type Base64File = { fileName: string; mimeType: string; base64: string };

export function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function downloadBase64File({ fileName, mimeType, base64 }: Base64File): void {
  const url = URL.createObjectURL(new Blob([base64ToBytes(base64) as BlobPart], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
