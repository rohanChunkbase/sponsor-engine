/** The person posts this themselves. These URLs open the network's compose screen. */
export function shareOnX(pageUrl: string, text: string): string {
  const intent = new URL("https://twitter.com/intent/tweet");
  intent.searchParams.set("text", text);
  intent.searchParams.set("url", pageUrl);
  return intent.toString();
}

export function shareOnLinkedIn(pageUrl: string): string {
  const intent = new URL("https://www.linkedin.com/sharing/share-offsite/");
  intent.searchParams.set("url", pageUrl);
  return intent.toString();
}
