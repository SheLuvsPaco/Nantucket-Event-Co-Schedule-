import { describe, expect, it } from "vitest";
import { isCrewRole, isRole, roleLabel } from "@/lib/roles";

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
});
