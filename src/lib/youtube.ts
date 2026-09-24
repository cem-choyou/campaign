// YouTube links (§8.6): the user pastes any URL, the app keeps the 11-character video id.

const ID = /^[A-Za-z0-9_-]{11}$/;

export function extractYoutubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (ID.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let candidate: string | null | undefined = null;

  if (host === "youtu.be") {
    candidate = url.pathname.split("/")[1];
  } else if (
    host === "youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "studio.youtube.com"
  ) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") candidate = url.searchParams.get("v");
    else if (["shorts", "embed", "live", "v", "video"].includes(parts[0] ?? ""))
      candidate = parts[1];
  }
  return candidate && ID.test(candidate) ? candidate : null;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}
