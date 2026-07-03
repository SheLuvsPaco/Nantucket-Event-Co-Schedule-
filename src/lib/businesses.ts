export const businesses = ["TENTS", "SOIREE", "PLACE_SETTERS"] as const;

export type Business = (typeof businesses)[number];

export const defaultBusiness: Business = "TENTS";

export const businessLabels: Record<Business, string> = {
  TENTS: "Tents",
  SOIREE: "Soiree",
  PLACE_SETTERS: "Place Setters",
};

export const businessSlugs: Record<Business, string> = {
  TENTS: "tents",
  SOIREE: "soiree",
  PLACE_SETTERS: "place-setters",
};

const slugToBusiness = new Map<string, Business>(
  businesses.map((business) => [businessSlugs[business], business]),
);

export function isBusiness(value: unknown): value is Business {
  return (
    typeof value === "string" &&
    (businesses as readonly string[]).includes(value)
  );
}

export function businessFromSlug(value: string | null | undefined) {
  if (!value) return null;
  return slugToBusiness.get(value.trim().toLowerCase()) ?? null;
}

export function normalizeBusinessSelection(values: Business[]) {
  const selected = businesses.filter((business) => values.includes(business));
  return selected.length ? selected : [...businesses];
}

export function parseBusinessFilter(
  value: string | string[] | undefined,
  fallback: Business[] = [...businesses],
) {
  const rawValue = Array.isArray(value) ? value.join(",") : value;
  if (!rawValue) return normalizeBusinessSelection(fallback);

  const selected = rawValue
    .split(",")
    .flatMap((part) => {
      const business = businessFromSlug(part);
      return business ? [business] : [];
    });

  return selected.length
    ? normalizeBusinessSelection(selected)
    : normalizeBusinessSelection(fallback);
}

export function businessFilterParam(selection: Business[]) {
  const normalized = normalizeBusinessSelection(selection);
  if (normalized.length === businesses.length) return null;
  return normalized.map((business) => businessSlugs[business]).join(",");
}

export function businessLabelList(selection: Business[]) {
  const normalized = normalizeBusinessSelection(selection);
  if (normalized.length === businesses.length) return "All branches";
  return normalized.map((business) => businessLabels[business]).join(" + ");
}
