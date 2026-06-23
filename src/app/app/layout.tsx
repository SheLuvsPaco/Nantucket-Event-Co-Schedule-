import { AccountMenu } from "@/components/account-menu";
import { AppNav } from "@/components/app-nav";
import { CompanyLogo } from "@/components/company-logo";
import { RoleSync } from "@/components/role-sync";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="app-shell">
      <RoleSync initialRole={session.role} />
      <aside className="sidebar">
        <div className="brand">
          <CompanyLogo className="brand-logo" priority />
        </div>

        <AppNav role={session.role} />

        <div className="sidebar-footer">
          <AccountMenu
            avatarUrl={session.avatarUrl}
            name={session.name}
            role={session.role}
          />
        </div>
      </aside>

      <main className="app-main" id="main-content">
        <header className="mobile-header">
          <CompanyLogo className="mobile-brand-logo" priority />
          <AccountMenu
            avatarUrl={session.avatarUrl}
            mobile
            name={session.name}
            role={session.role}
          />
        </header>
        {children}
      </main>

      <AppNav mobile role={session.role} />
    </div>
  );
}
