import type { BlogTag } from "../types/blog";

export function slugifyTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function isAllowedTag(t: string): t is BlogTag {
  return ["News", "Guide", "Advertisement", "Recruitment", "Event"].includes(t);
}
