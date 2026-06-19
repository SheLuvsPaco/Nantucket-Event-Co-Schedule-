import type { Metadata } from "next";
import { VehicleManager } from "@/components/vehicle-manager";
import { requireSession } from "@/lib/auth";
import { getVehicles } from "@/lib/data";

export const metadata: Metadata = {
  title: "Vehicles",
};

export default async function VehiclesPage() {
  await requireSession(["ADMIN", "OWNER"]);
  const vehicles = await getVehicles(true);

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Fleet control</p>
          <h1>Vehicles</h1>
        </div>
        <p className="schedule-intro">
          Keep the fleet ready and assign each load to a clear driver and destination.
        </p>
      </div>
      <VehicleManager initialVehicles={vehicles} />
    </div>
  );
}
