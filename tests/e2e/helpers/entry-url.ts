/**
 * Parse entry id from post-create edit URL: /entries/{id}/edit?created=1
 */
export function parseEntryIdFromEditUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const match = /\/entries\/([^/]+)\/edit/.exec(pathname);
  if (!match?.[1]) {
    throw new Error(`Expected edit URL, got: ${url}`);
  }
  return match[1];
}
