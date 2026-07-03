import { requireApiSession } from "@/lib/auth";

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  return Response.json({
    user: {
      id: auth.session.id,
      name: auth.session.name,
      avatarUrl: auth.session.avatarUrl,
      role: auth.session.role,
      business: auth.session.business,
    },
  });
}
