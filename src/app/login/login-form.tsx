"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import styles from "./login.module.css";

type DemoAccount = {
  label: string;
  name: string;
  password: string;
};

export function LoginForm({ demoAccounts }: { demoAccounts: DemoAccount[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "We could not sign you in. Please try again.");
        return;
      }
      router.push("/app/schedule");
      router.refresh();
    } catch {
      setError("We could not reach the schedule. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function fillDemo(account: DemoAccount) {
    setName(account.name);
    setPassword(account.password);
    setError("");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label htmlFor="name">Name</label>
        <div className={styles.inputWrap}>
          <Mail aria-hidden="true" />
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="username"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            required
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="password">Password</label>
        <div className={styles.inputWrap}>
          <LockKeyhole aria-hidden="true" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
            minLength={4}
            required
          />
        </div>
      </div>

      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}

      <button className={`button button-primary ${styles.submit}`} disabled={pending}>
        {pending ? "Signing you in…" : "Open schedule"}
        <ArrowRight aria-hidden="true" />
      </button>

      {demoAccounts.length ? (
        <div className={styles.demo}>
          <p>Demo access</p>
          <div className={styles.demoButtons}>
            {demoAccounts.map((account) => (
              <button
                key={account.label}
                type="button"
                onClick={() => fillDemo(account)}
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}
