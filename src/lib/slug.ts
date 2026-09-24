// URL slugs: "IT for Business" → "it-for-business".
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Appends -2, -3… until `isTaken` returns false. */
export async function uniqueSlug(base: string, isTaken: (slug: string) => Promise<boolean>) {
  const root = slugify(base) || "marque";
  let candidate = root;
  for (let i = 2; await isTaken(candidate); i++) candidate = `${root}-${i}`;
  return candidate;
}
