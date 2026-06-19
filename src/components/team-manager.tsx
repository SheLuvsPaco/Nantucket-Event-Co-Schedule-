"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil, Plus, Search, UserRound, X } from "lucide-react";
import type { Role } from "@/db/schema";
import type { UserRecord } from "@/types";
import styles from "./resource-manager.module.css";

type TeamDraft = Omit<UserRecord, "id"> & { password: string };

const emptyPerson: TeamDraft = {
  name: "",
  email: "",
  phone: "",
  role: "STAFF",
  active: true,
  password: "",
};

export function TeamManager({
  initialPeople,
  sessionUserId,
}: {
  initialPeople: UserRecord[];
  sessionUserId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"ALL" | Role>("ALL");
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<TeamDraft>(emptyPerson);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();
    return initialPeople.filter(
      (person) =>
        (role === "ALL" || person.role === role) &&
        (!needle ||
          person.name.toLowerCase().includes(needle) ||
          person.email.toLowerCase().includes(needle) ||
          person.phone?.toLowerCase().includes(needle)),
    );
  }, [initialPeople, query, role]);

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setDraft(emptyPerson);
    setError("");
  }

  function startEdit(person: UserRecord) {
    setCreating(false);
    setEditing(person);
    setDraft({
      name: person.name,
      email: person.email,
      phone: person.phone ?? "",
      role: person.role,
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

  const editorOpen = creating || editing !== null;

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
          <option value="STAFF">Staff</option>
        </select>
        <button className="button button-primary" onClick={startCreate} type="button">
          <Plus aria-hidden="true" /> Add person
        </button>
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
                    <option value="OWNER">Owner</option>
                    <option value="ADMIN">Admin</option>
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
              <span className={styles.listIcon}>
                <UserRound aria-hidden="true" />
              </span>
              <div className={styles.listMain}>
                <h2>
                  {person.name}
                  {person.id === sessionUserId ? " — You" : ""}
                </h2>
                <p>{person.email}</p>
                <div className={styles.listMeta}>
                  <span>{person.role.toLowerCase()}</span>
                  {person.phone ? <span>{person.phone}</span> : null}
                  {!person.active ? <span>Inactive</span> : null}
                </div>
              </div>
              <button
                aria-label={`Edit ${person.name}`}
                className="icon-button"
                onClick={() => startEdit(person)}
                type="button"
              >
                <Pencil aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel empty-state">
          <div>
            <UserRound aria-hidden="true" />
            <h2>No team members match</h2>
            <p className="muted">Clear the search or add a person.</p>
          </div>
        </div>
      )}
    </div>
  );
}
