import { requireApiSession } from "@/lib/auth";
import { getInventory, getPeople, getVehicles } from "@/lib/data";
import { apiError } from "@/lib/http";
import { buildPicklistPreview } from "@/lib/pdf-picklist";

export const runtime = "nodejs";

const maxPdfBytes = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireApiSession(["ADMIN", "OWNER"]);
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("pdf");

    if (!(file instanceof File)) {
      return Response.json({ error: "Upload a PDF picklist first." }, { status: 400 });
    }

    if (file.type && file.type !== "application/pdf") {
      return Response.json(
        { error: "Use the original PDF picklist file." },
        { status: 400 },
      );
    }

    if (file.size <= 0 || file.size > maxPdfBytes) {
      return Response.json(
        { error: "Use a PDF smaller than 12 MB." },
        { status: 400 },
      );
    }

    const [inventory, people, vehicles] = await Promise.all([
      getInventory(false, ["TENTS"]),
      getPeople(false, ["TENTS"]),
      getVehicles(false, ["TENTS"]),
    ]);

    const preview = await buildPicklistPreview(
      Buffer.from(await file.arrayBuffer()),
      inventory,
    );

    return Response.json({
      preview,
      catalog: {
        inventory,
        people,
        vehicles,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
