export function formatRelativeTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isSameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export function formatMaterialCategory(type: string): string {
  switch (type) {
    case "youtube":
      return "Listening";
    case "pdf":
    case "reading":
      return "Reading";
    default:
      return "Notes";
  }
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function getUploadedAssetUrl(filePath: string): string {
  if (filePath.startsWith("blob:")) {
    return `/api/uploads/blob?ref=${encodeURIComponent(filePath)}`;
  }
  return `/api/uploads/${filePath}`;
}
