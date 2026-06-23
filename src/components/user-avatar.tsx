"use client";

import { useState } from "react";
import styles from "./user-avatar.module.css";

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function UserAvatar({
  avatarUrl,
  className = "",
  name,
}: {
  avatarUrl: string | null | undefined;
  className?: string;
  name: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  return (
    <span
      aria-label={`${name}'s profile photo`}
      className={`${styles.avatar} ${className}`}
      role="img"
    >
      {avatarUrl && avatarUrl !== failedUrl ? (
        // Profile photos may be authenticated local routes or public Blob URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          onError={() => setFailedUrl(avatarUrl)}
          src={avatarUrl}
        />
      ) : (
        <span>{initialsFor(name)}</span>
      )}
    </span>
  );
}
