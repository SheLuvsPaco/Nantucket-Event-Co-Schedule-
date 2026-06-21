"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  CalendarDays,
  LogOut,
  Truck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import type { Role } from "@/db/schema";

const allLinks = [
  {
    href: "/app/schedule",
    label: "Schedule",
    icon: CalendarDays,
    roles: ["ADMIN", "OWNER", "STAFF"] satisfies Role[],
  },
  {
    href: "/app/only-me",
    label: "Only Me",
    icon: UserRoundCheck,
    roles: ["STAFF"] satisfies Role[],
  },
  {
    href: "/app/inventory",
    label: "Inventory",
    icon: Boxes,
    roles: ["ADMIN", "OWNER"] satisfies Role[],
  },
  {
    href: "/app/vehicles",
    label: "Vehicles",
    icon: Truck,
    roles: ["ADMIN", "OWNER"] satisfies Role[],
  },
  {
    href: "/app/team",
    label: "Team",
    icon: UsersRound,
    roles: ["ADMIN"] satisfies Role[],
  },
];

export function AppNav({
  role,
  mobile = false,
}: {
  role: Role;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const links = allLinks.filter((link) => link.roles.includes(role));

  return (
    <nav className={mobile ? "mobile-nav" : "sidebar-nav"} aria-label="Main">
      {links.map((link) => {
        const Icon = link.icon;
        const active = pathname.startsWith(link.href);
        return (
          <Link
            className="nav-link"
            data-active={active}
            href={link.href}
            key={link.href}
          >
            <Icon aria-hidden="true" />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function LogoutButton({
  mobileMenu = false,
}: {
  mobileMenu?: boolean;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      className={mobileMenu ? "mobile-logout-button" : "nav-link logout-button"}
      onClick={logout}
      type="button"
    >
      <LogOut aria-hidden="true" />
      <span>Sign out</span>
    </button>
  );
}
