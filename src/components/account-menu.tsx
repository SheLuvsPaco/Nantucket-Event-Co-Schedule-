"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  Camera,
  ChevronLeft,
  KeyRound,
  LogOut,
  Send,
  Trash2,
} from "lucide-react";
import type { Role } from "@/db/schema";
import { roleLabel } from "@/lib/roles";
import { UserAvatar } from "./user-avatar";
import styles from "./account-menu.module.css";

type MenuView = "menu" | "notifications" | "photo" | "password";
type PushState =
  | "checking"
  | "denied"
  | "disabled"
  | "enabled"
  | "unavailable"
  | "unconfigured";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const bytes = atob(base64);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

export function AccountMenu({
  avatarUrl: initialAvatarUrl,
  mobile = false,
  name,
  role,
}: {
  avatarUrl: string | null;
  mobile?: boolean;
  name: string;
  role: Role;
}) {
  const router = useRouter();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [view, setView] = useState<MenuView>("menu");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pushState, setPushState] = useState<PushState>("checking");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function resetMessages() {
    setError("");
    setSuccess("");
  }

  function changeView(nextView: MenuView) {
    resetMessages();
    setView(nextView);
  }

  async function getPushConfiguration() {
    const response = await fetch("/api/push/config", { cache: "no-store" });
    const data = (await response.json()) as {
      configured?: boolean;
      publicKey?: string | null;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error ?? "Notification settings could not be loaded.");
    }
    return data;
  }

  async function checkPushStatus() {
    resetMessages();
    setPushState("checking");

    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPushState("unavailable");
      return;
    }

    try {
      const configuration = await getPushConfiguration();
      if (!configuration.configured || !configuration.publicKey) {
        setPushState("unconfigured");
        return;
      }
      if (Notification.permission === "denied") {
        setPushState("denied");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setPushState(subscription ? "enabled" : "disabled");
    } catch (statusError) {
      setPushState("disabled");
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Notification settings could not be loaded.",
      );
    }
  }

  async function enablePushNotifications() {
    setPending(true);
    resetMessages();
    try {
      const configuration = await getPushConfiguration();
      if (!configuration.configured || !configuration.publicKey) {
        setPushState("unconfigured");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("denied");
        setError(
          "Notifications are blocked for this app. Allow them in your phone settings, then try again.",
        );
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(configuration.publicKey),
        }));

      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        if (!existing) await subscription.unsubscribe().catch(() => false);
        throw new Error(data.error ?? "Notifications could not be enabled.");
      }

      setPushState("enabled");
      setSuccess("Notifications enabled on this phone.");
    } catch (enableError) {
      setError(
        enableError instanceof Error
          ? enableError.message
          : "Notifications could not be enabled.",
      );
    } finally {
      setPending(false);
    }
  }

  async function disablePushNotifications() {
    setPending(true);
    resetMessages();
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Notifications could not be disabled.");
        }
        await subscription.unsubscribe();
      }

      setPushState("disabled");
      setSuccess("Notifications disabled on this phone.");
    } catch (disableError) {
      setError(
        disableError instanceof Error
          ? disableError.message
          : "Notifications could not be disabled.",
      );
    } finally {
      setPending(false);
    }
  }

  async function sendTestNotification() {
    setPending(true);
    resetMessages();
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "The test notification could not be sent.");
      }
      setSuccess("Test sent. It should appear on this phone now.");
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : "The test notification could not be sent.",
      );
    } finally {
      setPending(false);
    }
  }

  async function uploadPhoto(file: File | null) {
    if (!file) return;
    const formData = new FormData();
    formData.set("avatar", file);

    setPending(true);
    resetMessages();
    try {
      const response = await fetch("/api/account/avatar", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        avatarUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.avatarUrl) {
        setError(data.error ?? "The profile photo could not be saved.");
        return;
      }

      setAvatarUrl(data.avatarUrl);
      setSuccess("Profile photo updated.");
      router.refresh();
    } catch {
      setError("We could not upload the photo. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function removePhoto() {
    setPending(true);
    resetMessages();
    try {
      const response = await fetch("/api/account/avatar", {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The profile photo could not be removed.");
        return;
      }

      setAvatarUrl(null);
      setSuccess("Profile photo removed.");
      router.refresh();
    } catch {
      setError("We could not remove the photo. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function changePassword() {
    setPending(true);
    resetMessages();
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The password could not be changed.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password changed successfully.");
    } catch {
      setError("We could not change the password. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await fetch("/api/push/subscriptions", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          await subscription.unsubscribe();
        }
      } catch {
        // Signing out must still work if push cleanup is unavailable.
      }
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <details
      className={mobile ? styles.mobileAccount : styles.desktopAccount}
      onToggle={(event) => {
        if (!event.currentTarget.open) {
          setView("menu");
          resetMessages();
        }
      }}
      ref={detailsRef}
    >
      <summary
        aria-label={`Open account menu for ${name}`}
        className={mobile ? styles.mobileSummary : styles.desktopSummary}
      >
        <UserAvatar
          avatarUrl={avatarUrl}
          className={mobile ? styles.mobileAvatar : styles.desktopAvatar}
          name={name}
        />
        {mobile ? null : (
          <span className={styles.desktopIdentity}>
            <strong>{name}</strong>
            <span>{roleLabel(role)}</span>
          </span>
        )}
      </summary>

      <div className={styles.menu}>
        {view === "menu" ? (
          <>
            <div className={styles.profile}>
              <UserAvatar
                avatarUrl={avatarUrl}
                className={styles.profileAvatar}
                name={name}
              />
              <div>
                <strong>{name}</strong>
                <span>{roleLabel(role)}</span>
              </div>
            </div>
            <button
              className={styles.menuButton}
              onClick={() => changeView("photo")}
              type="button"
            >
              <Camera aria-hidden="true" />
              Change profile photo
            </button>
            <button
              className={styles.menuButton}
              onClick={() => changeView("password")}
              type="button"
            >
              <KeyRound aria-hidden="true" />
              Change password
            </button>
            <button
              className={styles.menuButton}
              onClick={() => {
                changeView("notifications");
                void checkPushStatus();
              }}
              type="button"
            >
              <Bell aria-hidden="true" />
              Phone notifications
            </button>
            <button
              className={`${styles.menuButton} ${styles.signOut}`}
              onClick={logout}
              type="button"
            >
              <LogOut aria-hidden="true" />
              Sign out
            </button>
          </>
        ) : null}

        {view === "photo" ? (
          <div className={styles.settings}>
            <button
              className={styles.backButton}
              onClick={() => changeView("menu")}
              type="button"
            >
              <ChevronLeft aria-hidden="true" />
              Account
            </button>
            <div className={styles.settingsHeading}>
              <UserAvatar
                avatarUrl={avatarUrl}
                className={styles.settingsAvatar}
                name={name}
              />
              <div>
                <strong>Profile photo</strong>
                <span>Use a clear photo of your face.</span>
              </div>
            </div>
            <label className={styles.uploadButton}>
              <Camera aria-hidden="true" />
              {pending ? "Uploading…" : "Choose photo"}
              <input
                accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                disabled={pending}
                onChange={(event) => {
                  void uploadPhoto(event.target.files?.item(0) ?? null);
                  event.currentTarget.value = "";
                }}
                type="file"
              />
            </label>
            {avatarUrl ? (
              <button
                className={styles.removeButton}
                disabled={pending}
                onClick={removePhoto}
                type="button"
              >
                <Trash2 aria-hidden="true" />
                Remove photo
              </button>
            ) : null}
          </div>
        ) : null}

        {view === "password" ? (
          <div className={styles.settings}>
            <button
              className={styles.backButton}
              onClick={() => changeView("menu")}
              type="button"
            >
              <ChevronLeft aria-hidden="true" />
              Account
            </button>
            <div>
              <strong className={styles.settingsTitle}>Change password</strong>
              <p className={styles.settingsCopy}>
                Your name stays the same. Use the new password next time you sign in.
              </p>
            </div>
            <label className={styles.passwordField}>
              <span>Current password</span>
              <input
                autoComplete="current-password"
                disabled={pending}
                onChange={(event) => setCurrentPassword(event.target.value)}
                type="password"
                value={currentPassword}
              />
            </label>
            <label className={styles.passwordField}>
              <span>New password</span>
              <input
                autoComplete="new-password"
                disabled={pending}
                minLength={8}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                value={newPassword}
              />
            </label>
            <label className={styles.passwordField}>
              <span>Confirm new password</span>
              <input
                autoComplete="new-password"
                disabled={pending}
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                value={confirmPassword}
              />
            </label>
            <button
              className={styles.saveButton}
              disabled={
                pending ||
                !currentPassword ||
                newPassword.length < 8 ||
                confirmPassword.length < 8
              }
              onClick={changePassword}
              type="button"
            >
              {pending ? "Changing password…" : "Change password"}
            </button>
          </div>
        ) : null}

        {view === "notifications" ? (
          <div className={styles.settings}>
            <button
              className={styles.backButton}
              onClick={() => changeView("menu")}
              type="button"
            >
              <ChevronLeft aria-hidden="true" />
              Account
            </button>
            <div className={styles.notificationHeading}>
              <span className={styles.notificationIcon}>
                {pushState === "enabled" ? (
                  <BellRing aria-hidden="true" />
                ) : (
                  <Bell aria-hidden="true" />
                )}
              </span>
              <div>
                <strong className={styles.settingsTitle}>
                  Phone notifications
                </strong>
                <p className={styles.settingsCopy}>
                  Get alerts for assignments, schedule changes, vehicles,
                  invoices, and morning calls.
                </p>
              </div>
            </div>

            <div className={styles.notificationStatus}>
              <span
                className={
                  pushState === "enabled"
                    ? styles.statusEnabled
                    : styles.statusNeutral
                }
              />
              {pushState === "checking"
                ? "Checking this phone…"
                : pushState === "enabled"
                  ? "Enabled on this phone"
                  : pushState === "denied"
                    ? "Blocked in phone settings"
                    : pushState === "unconfigured"
                      ? "Not available until server setup is complete"
                      : pushState === "unavailable"
                        ? "Install the PWA to your Home Screen, then try again"
                        : "Not enabled on this phone"}
            </div>

            {pushState === "disabled" ? (
              <button
                className={styles.saveButton}
                disabled={pending}
                onClick={enablePushNotifications}
                type="button"
              >
                <BellRing aria-hidden="true" />
                {pending ? "Enabling…" : "Enable notifications"}
              </button>
            ) : null}

            {pushState === "enabled" ? (
              <div className={styles.notificationActions}>
                <button
                  className={styles.saveButton}
                  disabled={pending}
                  onClick={sendTestNotification}
                  type="button"
                >
                  <Send aria-hidden="true" />
                  {pending ? "Sending…" : "Send test"}
                </button>
                <button
                  className={styles.removeButton}
                  disabled={pending}
                  onClick={disablePushNotifications}
                  type="button"
                >
                  Disable on this phone
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className={styles.success} role="status">
            {success}
          </p>
        ) : null}
      </div>
    </details>
  );
}
