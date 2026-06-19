import { ZodError } from "zod";
import { formatZodError } from "@/lib/validation";

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json({ error: formatZodError(error) }, { status: 400 });
  }

  console.error(error);
  return Response.json(
    { error: "Something went wrong on our end. Please try again." },
    { status: 500 },
  );
}
