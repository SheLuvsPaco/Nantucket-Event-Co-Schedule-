import { AppNav, LogoutButton } from "@/components/app-nav";
import { CompanyLogo } from "@/components/company-logo";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const initials = session.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <CompanyLogo className="brand-logo" priority />
        </div>

        <AppNav role={session.role} />

        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="user-avatar">{initials}</span>
            <span>
              <strong>{session.name}</strong>
              <span>{session.role.toLowerCase()}</span>
            </span>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="app-main" id="main-content">
        <header className="mobile-header">
          <CompanyLogo className="mobile-brand-logo" priority />
          <details className="mobile-account">
            <summary className="mobile-role">
              {session.role.toLowerCase()}
            </summary>
            <div className="mobile-account-menu">
              <div>
                <strong>{session.name}</strong>
                <span>{session.role.toLowerCase()}</span>
              </div>
              <LogoutButton mobileMenu />
            </div>
          </details>
        </header>
        {children}
      </main>

      <AppNav mobile role={session.role} />
    </div>
  );
}
