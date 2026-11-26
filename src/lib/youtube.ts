const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export interface ParsedYouTubeUrl {
  videoId: string;
  canonicalUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
}

export function parseYouTubeUrl(rawInput: string): ParsedYouTubeUrl | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    url = new URL(withProtocol);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(hostname)) {
    return null;
  }

  let candidateId: string | null = null;

  if (hostname === "youtu.be" || hostname === "www.youtu.be") {
    const segments = url.pathname.split("/").filter(Boolean);
    candidateId = segments[0] ?? null;
  } else {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] === "watch") {
      candidateId = url.searchParams.get("v");
    } else if (
      segments[0] === "shorts" ||
      segments[0] === "embed" ||
      segments[0] === "live"
    ) {
      candidateId = segments[1] ?? null;
    } else if (url.searchParams.has("v")) {
      candidateId = url.searchParams.get("v");
    }
  }

  if (!candidateId || !YOUTUBE_ID_REGEX.test(candidateId)) {
    return null;
  }

  return {
    videoId: candidateId,
    canonicalUrl: `https://www.youtube.com/watch?v=${candidateId}`,
    embedUrl: `https://www.youtube.com/embed/${candidateId}?enablejsapi=1&rel=0&modestbranding=1`,
    thumbnailUrl: `https://i.ytimg.com/vi/${candidateId}/hqdefault.jpg`,
  };
}
