export function humanizeCheckId(id: string): string {
  const lastSegment = id.split(".").pop() ?? id;
  return lastSegment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
