import type { Metadata } from "next";
import { InventoryManager } from "@/components/inventory-manager";
import { requireSession } from "@/lib/auth";
import { getInventory } from "@/lib/data";

export const metadata: Metadata = {
  title: "Inventory",
};

export default async function InventoryPage() {
  await requireSession(["ADMIN", "OWNER"]);
  const inventory = await getInventory(true);

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Warehouse truth</p>
          <h1>Inventory</h1>
        </div>
        <p className="schedule-intro">
          Keep counts, sizes, images, and packing notes current for every event.
        </p>
      </div>
      <InventoryManager initialItems={inventory} />
    </div>
  );
}
