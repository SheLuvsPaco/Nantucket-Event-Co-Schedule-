import "server-only";

import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems, users, vehicles } from "@/db/schema";
import { isManagedBlobUrl } from "@/lib/image-upload";

export async function deleteManagedImageIfUnreferenced(
  imageUrl: string | null | undefined,
) {
  if (!isManagedBlobUrl(imageUrl)) return false;

  const [inventoryReference, vehicleReference, userReference] = await Promise.all([
    db
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(eq(inventoryItems.imageUrl, imageUrl))
      .limit(1),
    db
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(eq(vehicles.imageUrl, imageUrl))
      .limit(1),
    db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.avatarUrl, imageUrl))
      .limit(1),
  ]);

  if (
    inventoryReference.length ||
    vehicleReference.length ||
    userReference.length
  ) {
    return false;
  }

  await del(imageUrl);
  return true;
}

export async function removeReplacedManagedImage(
  previousUrl: string | null | undefined,
  currentUrl: string | null | undefined,
) {
  if (!previousUrl || previousUrl === currentUrl) return;

  try {
    await deleteManagedImageIfUnreferenced(previousUrl);
  } catch (error) {
    console.error("Unable to remove replaced Blob image:", error);
  }
}
