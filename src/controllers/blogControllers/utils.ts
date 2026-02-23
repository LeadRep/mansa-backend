export const slugifyTitle = (title: string) => {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return base || "post";
};

export const buildExcerpt = (content: string, maxLength = 200) => {
  const stripped = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (stripped.length <= maxLength) {
    return stripped;
  }
  return `${stripped.slice(0, maxLength).trim()}...`;
};
