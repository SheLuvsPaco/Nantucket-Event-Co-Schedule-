import { describe, expect, it } from "vitest";
import {
  getUnassignedCrew,
  isCrewRole,
  isRole,
  roleLabel,
} from "@/lib/roles";

describe("role helpers", () => {
  it("recognizes Lead as a valid crew role", () => {
    expect(isRole("LEAD")).toBe(true);
    expect(isCrewRole("LEAD")).toBe(true);
    expect(roleLabel("LEAD")).toBe("Lead");
  });

  it("keeps privileged roles outside crew-only permissions", () => {
    expect(isCrewRole("ADMIN")).toBe(false);
    expect(isCrewRole("OWNER")).toBe(false);
  });

  it("returns only crew members who have not already been assigned", () => {
    const crew = [
      { id: "usr_lead", name: "Lead" },
      { id: "usr_one", name: "Crew one" },
      { id: "usr_two", name: "Crew two" },
    ];

    expect(
      getUnassignedCrew(crew, [
        { userId: "usr_lead" },
        { userId: "usr_two" },
      ]),
    ).toEqual([{ id: "usr_one", name: "Crew one" }]);
  });
});
