import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompanyLogo } from "@/components/company-logo";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/app/schedule");

  const demoAccounts = env.DEMO_MODE
    ? [
        {
          label: "Admin",
          name: "Nantucket Event Admin",
          password: process.env.SEED_ADMIN_PASSWORD ?? "",
        },
        {
          label: "Owner",
          name: "Porter",
          password: "Porter1234",
        },
        {
          label: "Staff",
          name: "Fuerte",
          password: "Fuerte1234",
        },
      ]
    : [];

  return (
    <main className={styles.page}>
      <section className={styles.story}>
        <div className={styles.storyTop}>
          <div className={styles.brandLine}>
            <CompanyLogo className={styles.brandLogo} priority />
          </div>
          <p className={styles.kicker}>Field operations, without the group chat.</p>
        </div>

        <div className={styles.statement}>
          <p className={styles.quoteMark}>“</p>
          <h1>One clear plan for every tent, truck, and person.</h1>
          <p>
            The season changes fast. The schedule should keep up without making
            the crew decode another wall of text.
          </p>
        </div>

        <div className={styles.signal}>
          <span className={styles.signalDot} />
          <span>Built for {env.COMPANY_NAME}</span>
        </div>
      </section>

      <section className={styles.login}>
        <div className={styles.loginInner}>
          <div>
            <p className="eyebrow">Welcome back</p>
            <h2 className={styles.loginTitle}>See the plan. Get moving.</h2>
            <p className={styles.loginCopy}>
              Sign in to view today&apos;s work and the full season schedule.
            </p>
          </div>
          <LoginForm demoAccounts={demoAccounts} />
        </div>
      </section>
    </main>
  );
}
