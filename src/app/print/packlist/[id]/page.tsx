import { notFound } from "next/navigation";
import { getEventById } from "@/lib/data";
import { formatLongDate, formatTime } from "@/lib/date";
import { requireSession } from "@/lib/auth";
import { isCountFreePackItem } from "@/lib/pack-list";
import { AutoPrint } from "./auto-print";
import styles from "../../packlist.module.css";

export default async function PrintPacklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireSession();
  if (!auth) return notFound();

  const { id } = await params;
  console.log("====> PRINT VIEW: Fetching event with ID:", id);
  const event = await getEventById(id);
  console.log("====> PRINT VIEW: getEventById returned:", !!event);

  if (!event) return notFound();

  // Group inventory items by category
  const groupedInventory = event.inventory.reduce((acc, entry) => {
    const category = entry.item?.category || "Uncategorized";
    if (!acc[category]) acc[category] = [];
    acc[category].push(entry);
    return acc;
  }, {} as Record<string, typeof event.inventory>);

  const vehiclesText = event.vehicles.length
    ? event.vehicles.map(v => v.vehicle?.name).filter(Boolean).join(", ")
    : "None Assigned";

  return (
    <div className={styles.printContainer}>
      <AutoPrint />

      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {/* Using standard img tag to ensure it loads synchronously for print without next/image optimization interference */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.png"
            alt="Nantucket Event Co"
            className={styles.logo}
          />
        </div>

        <div className={styles.headerCenter}>
          <h1 className={styles.eventTitle}>{event.title}</h1>
          <p className={styles.eventSub}>{formatLongDate(event.eventDate)}</p>
          <div className={styles.eventDetails}>
            {event.clientName && <span><strong>Client:</strong> {event.clientName}</span>}
            {event.venue && <span><strong>Venue:</strong> {event.venue}</span>}
            {event.callTime && <span><strong>Call Time:</strong> {formatTime(event.callTime)}</span>}
          </div>
          <div className={styles.vehiclesBox}>
            <strong>Load into vehicles:</strong> {vehiclesText}
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.packerBadge}>
            <span className={styles.packerLabel}>Assigned Packer</span>
            <span className={styles.packerName}>{event.packer?.name || "Unassigned"}</span>
          </div>
        </div>
      </header>

      <main className={styles.mainContent}>
        {Object.entries(groupedInventory).map(([category, items]) => (
          <section key={category} className={styles.categorySection}>
            <h2 className={styles.categoryTitle}>{category}</h2>
            <table className={styles.packTable}>
              <thead>
                <tr>
                  <th className={styles.colCheck}>Pack</th>
                  <th className={styles.colQty}>Qty</th>
                  <th className={styles.colItem}>Item</th>
                  <th className={styles.colNotes}>Notes & Details</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr key={entry.inventoryItemId} className={styles.itemRow}>
                    <td className={styles.colCheck}>
                      <div className={styles.checkboxOutline}></div>
                    </td>
                    <td className={styles.colQty}>
                      {isCountFreePackItem(entry.item?.name) ? null : (
                        <span className={styles.qtyNumber}>{entry.quantity}</span>
                      )}
                    </td>
                    <td className={styles.colItem}>
                      <strong>{entry.item?.name}</strong>
                      {entry.item?.size && <span className={styles.itemSize}> ({entry.item.size})</span>}
                    </td>
                    <td className={styles.colNotes}>
                      {entry.notes && <span className={styles.userNote}>{entry.notes}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        {event.inventory.length === 0 && (
          <p className={styles.emptyList}>No items on the pack list.</p>
        )}
      </main>

      <footer className={styles.footer}>
        Generated on {new Date().toLocaleDateString()} by Porter Codex
      </footer>
    </div>
  );
}
