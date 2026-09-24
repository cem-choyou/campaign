// Only same-origin relative paths are accepted as post-login destinations (no open redirect).
export function safeCallbackPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/api/auth")) return fallback;
  return value;
}
