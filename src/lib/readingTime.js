// src/lib/readingTime.js
// Rough reading-time estimate from a book's cloud `bytes` (~chars, ~200 wpm)
// — lets a reader judge commitment size before opening a book cold.

export function readingMinutes(bytes) {
  if (!bytes) return null;
  return Math.max(1, Math.round(bytes / 1000));
}

export function readingTimeLabel(bytes) {
  const mins = readingMinutes(bytes);
  if (mins == null) return null;
  if (mins < 60) return `${mins} min read`;
  return `${Math.round(mins / 60)} hr read`;
}
