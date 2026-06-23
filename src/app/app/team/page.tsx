import type { Metadata } from "next";
import { TeamManager } from "@/components/team-manager";
import { requireSession } from "@/lib/auth";
import { getPeople } from "@/lib/data";

export const metadata: Metadata = {
  title: "Team",
};

export default async function TeamPage() {
  const session = await requireSession(["ADMIN", "OWNER"]);
  const people = await getPeople(true);
  const isAdmin = session.role === "ADMIN";
  const viewerRole = isAdmin ? "ADMIN" : "OWNER";

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Access and crew</p>
          <h1>Team</h1>
        </div>
        <p className="schedule-intro">
          {isAdmin
            ? "Create accounts, control roles, and keep the working crew list current."
            : "Assign crew leads while keeping account access under admin control."}
        </p>
      </div>
      <TeamManager
        initialPeople={people}
        sessionUserId={session.id}
        viewerRole={viewerRole}
      />
    </div>
  );
}
