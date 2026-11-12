const trackedUrls = new Set<string>();

export function trackObjectUrl(url: string): void {
  trackedUrls.add(url);
}

export function revokeObjectUrl(url: string): void {
  if (!trackedUrls.delete(url)) return;
  URL.revokeObjectURL(url);
}

export function revokeUnusedObjectUrls(referencedUrls: Set<string>): void {
  for (const url of trackedUrls) {
    if (!referencedUrls.has(url)) revokeObjectUrl(url);
  }
}

window.addEventListener('pagehide', () => {
  for (const url of trackedUrls) URL.revokeObjectURL(url);
  trackedUrls.clear();
});
