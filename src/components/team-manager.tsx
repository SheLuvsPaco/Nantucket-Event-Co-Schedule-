"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil, Plus, Search, UserRound, X } from "lucide-react";
import type { Role } from "@/db/schema";
import {
  businesses,
  businessLabels,
  defaultBusiness,
  type Business,
} from "@/lib/businesses";
import { isCrewRole, roleLabel, type CrewRole } from "@/lib/roles";
import type { UserRecord } from "@/types";
import { UserAvatar } from "./user-avatar";
import styles from "./resource-manager.module.css";

type TeamDraft = Omit<UserRecord, "id"> & { password: string };

const emptyPerson: TeamDraft = {
  name: "",
  email: "",
  phone: "",
  avatarUrl: null,
  role: "STAFF",
  business: defaultBusiness,
  active: true,
  password: "",
};

type BusinessFilter = "ALL" | Business;

export function TeamManager({
  initialPeople,
  sessionUserId,
  viewerRole,
}: {
  initialPeople: UserRecord[];
  sessionUserId: string;
  viewerRole: Extract<Role, "ADMIN" | "OWNER">;
}) {
  const router = useRouter();
  const isAdmin = viewerRole === "ADMIN";
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"ALL" | Role>("ALL");
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>("ALL");
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<TeamDraft>(emptyPerson);
  const [pending, setPending] = useState(false);
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
  const [roleOverrides, setRoleOverrides] = useState<
    Partial<Record<string, CrewRole>>
  >({});
  const [businessOverrides, setBusinessOverrides] = useState<
    Partial<Record<string, Business>>
  >({});
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();
    return initialPeople.filter(
      (person) => {
        const currentRole = roleOverrides[person.id] ?? person.role;
        const currentBusiness = businessOverrides[person.id] ?? person.business;
        return (
          (role === "ALL" || currentRole === role) &&
          (businessFilter === "ALL" || currentBusiness === businessFilter) &&
          (!needle ||
            person.name.toLowerCase().includes(needle) ||
            person.email.toLowerCase().includes(needle) ||
            person.phone?.toLowerCase().includes(needle))
        );
      },
    );
  }, [businessFilter, businessOverrides, initialPeople, query, role, roleOverrides]);

  function startCreate() {
    if (!isAdmin) return;
    setEditing(null);
    setCreating(true);
    setDraft({
      ...emptyPerson,
      business: businessFilter === "ALL" ? defaultBusiness : businessFilter,
    });
    setError("");
  }

  function startEdit(person: UserRecord) {
    if (!isAdmin) return;
    setCreating(false);
    setEditing(person);
    setDraft({
      name: person.name,
      email: person.email,
      phone: person.phone ?? "",
      avatarUrl: person.avatarUrl,
      role: person.role,
      business: person.business,
      active: person.active,
      password: "",
    });
    setError("");
  }

  function closeEditor() {
    setCreating(false);
    setEditing(null);
    setError("");
  }

  async function save() {
    if (!isAdmin) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        editing ? `/api/people/${editing.id}` : "/api/people",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The team member could not be saved.");
        return;
      }
      closeEditor();
      router.refresh();
    } catch {
      setError("We could not reach the schedule. Check your connection and save again.");
    } finally {
      setPending(false);
    }
  }

  async function deactivate(person: UserRecord) {
    if (!isAdmin) return;
    if (
      !window.confirm(
        `Deactivate “${person.name}”? They will no longer be able to sign in.`,
      )
    ) {
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/people/${person.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The account could not be deactivated.");
        return;
      }
      closeEditor();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function changeCrewProfile(
    person: UserRecord,
    update: { role?: CrewRole; business?: Business },
  ) {
    const currentRole = roleOverrides[person.id] ?? person.role;
    const currentBusiness = businessOverrides[person.id] ?? person.business;
    if (!isCrewRole(currentRole)) return;
    if (
      (!update.role || update.role === currentRole) &&
      (!update.business || update.business === currentBusiness)
    ) {
      return;
    }

    setPendingRoleId(person.id);
    setError("");
    try {
      const response = await fetch(`/api/people/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The role could not be changed.");
        return;
      }
      if (update.role) {
        setRoleOverrides((current) => ({ ...current, [person.id]: update.role }));
      }
      if (update.business) {
        setBusinessOverrides((current) => ({
          ...current,
          [person.id]: update.business,
        }));
      }
      router.refresh();
    } catch {
      setError("We could not reach the schedule. Check your connection and try again.");
    } finally {
      setPendingRoleId(null);
    }
  }

  const editorOpen = isAdmin && (creating || editing !== null);

  return (
    <div className={styles.manager}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Search aria-hidden="true" />
          <input
            aria-label="Search team"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, or phone"
          />
        </div>
        <select
          aria-label="Filter team by role"
          className="select"
          value={role}
          onChange={(event) => setRole(event.target.value as "ALL" | Role)}
        >
          <option value="ALL">All roles</option>
          <option value="ADMIN">Admins</option>
          <option value="OWNER">Owners</option>
          <option value="LEAD">Leads</option>
          <option value="STAFF">Staff</option>
        </select>
        <select
          aria-label="Filter team by business"
          className="select"
          value={businessFilter}
          onChange={(event) =>
            setBusinessFilter(event.target.value as BusinessFilter)
          }
        >
          <option value="ALL">All branches</option>
          {businesses.map((business) => (
            <option key={business} value={business}>
              {businessLabels[business]}
            </option>
          ))}
        </select>
        {isAdmin ? (
          <button className="button button-primary" onClick={startCreate} type="button">
            <Plus aria-hidden="true" /> Add person
          </button>
        ) : null}
      </div>

      {editorOpen ? (
        <section className={`${styles.editor} panel`}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">{editing ? "Edit account" : "New account"}</p>
              <h2>{editing?.name ?? "Add team member"}</h2>
            </div>
            <button
              aria-label="Close team editor"
              className="icon-button"
              onClick={closeEditor}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <div className="form-grid form-grid-3">
                <div className="field">
                  <label htmlFor="person-name">Full name</label>
                  <input
                    className="input"
                    id="person-name"
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Crew member name"
                  />
                </div>
                <div className="field">
                  <label htmlFor="person-role">Role</label>
                  <select
                    className="select"
                    id="person-role"
                    value={draft.role}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        role: event.target.value as Role,
                      }))
                    }
                  >
                    <option value="STAFF">Staff</option>
                    <option value="LEAD">Lead</option>
                    <option value="OWNER">Owner</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="person-business">Business allocation</label>
                  <select
                    className="select"
                    id="person-business"
                    value={draft.business}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        business: event.target.value as Business,
                      }))
                    }
                  >
                    {businesses.map((business) => (
                      <option key={business} value={business}>
                        {businessLabels[business]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="person-phone">Phone</label>
                  <input
                    className="input"
                    id="person-phone"
                    type="tel"
                    value={draft.phone ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, phone: event.target.value }))
                    }
                    placeholder="508-555-0100"
                  />
                </div>
              </div>
              <div className="form-grid form-grid-2">
                <div className="field">
                  <label htmlFor="person-email">Email address</label>
                  <input
                    className="input"
                    id="person-email"
                    type="email"
                    value={draft.email}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="name@company.com"
                  />
                </div>
                <div className="field">
                  <label htmlFor="person-password">
                    {editing ? "New password (optional)" : "Temporary password"}
                  </label>
                  <input
                    className="input"
                    id="person-password"
                    minLength={8}
                    type="password"
                    value={draft.password}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder={editing ? "Leave blank to keep current" : "8+ characters"}
                  />
                </div>
              </div>
              {editing ? (
                <label className={styles.checkRow}>
                  <input
                    checked={draft.active}
                    disabled={editing.id === sessionUserId}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        active: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  Active account with sign-in access
                </label>
              ) : null}
              {error ? (
                <p className="error-message" role="alert">
                  {error}
                </p>
              ) : null}
              <div className={styles.editorActions}>
                {editing && editing.id !== sessionUserId ? (
                  <button
                    className="button button-danger"
                    disabled={pending}
                    onClick={() => deactivate(editing)}
                    type="button"
                  >
                    <Archive aria-hidden="true" /> Deactivate account
                  </button>
                ) : (
                  <span />
                )}
                <button
                  className="button button-primary"
                  disabled={pending}
                  onClick={save}
                  type="button"
                >
                  {pending ? "Saving account…" : "Save account"}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {error && !editorOpen ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}

      {filtered.length ? (
        <div className={styles.list}>
          {filtered.map((person) => (
            <article
              className={styles.listItem}
              data-inactive={!person.active}
              key={person.id}
            >
              <UserAvatar
                avatarUrl={person.avatarUrl}
                className={styles.listAvatar}
                name={person.name}
              />
              <div className={styles.listMain}>
                <h2>
                  {person.name}
                  {person.id === sessionUserId ? " — You" : ""}
                </h2>
                <p>{person.email}</p>
                <div className={styles.listMeta}>
                  <span>{roleLabel(roleOverrides[person.id] ?? person.role)}</span>
                  <span>
                    {businessLabels[
                      businessOverrides[person.id] ?? person.business
                    ]}
                  </span>
                  {person.phone ? <span>{person.phone}</span> : null}
                  {!person.active ? <span>Inactive</span> : null}
                </div>
              </div>
              {isAdmin ? (
                <button
                  aria-label={`Edit ${person.name}`}
                  className="icon-button"
                  onClick={() => startEdit(person)}
                  type="button"
                >
                  <Pencil aria-hidden="true" />
                </button>
              ) : isCrewRole(person.role) ? (
                <div className={styles.profileEditors}>
                  <div className={styles.roleEditor}>
                    <label htmlFor={`role-${person.id}`}>Crew role</label>
                    <select
                      aria-label={`Change ${person.name}'s role`}
                      className="select"
                      disabled={pendingRoleId === person.id}
                      id={`role-${person.id}`}
                      onChange={(event) =>
                        changeCrewProfile(person, {
                          role: event.target.value as CrewRole,
                        })
                      }
                      value={roleOverrides[person.id] ?? person.role}
                    >
                      <option value="STAFF">Staff</option>
                      <option value="LEAD">Lead</option>
                    </select>
                  </div>
                  <div className={styles.roleEditor}>
                    <label htmlFor={`business-${person.id}`}>Business</label>
                    <select
                      aria-label={`Change ${person.name}'s business`}
                      className="select"
                      disabled={pendingRoleId === person.id}
                      id={`business-${person.id}`}
                      onChange={(event) =>
                        changeCrewProfile(person, {
                          business: event.target.value as Business,
                        })
                      }
                      value={businessOverrides[person.id] ?? person.business}
                    >
                      {businesses.map((business) => (
                        <option key={business} value={business}>
                          {businessLabels[business]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <span className={styles.adminManaged}>Admin managed</span>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="panel empty-state">
          <div>
            <UserRound aria-hidden="true" />
            <h2>No team members match</h2>
            <p className="muted">
              {isAdmin
                ? "Clear the search or add a person."
                : "Clear the search or choose another role."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
