const PASSWORD_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_PASSWORD_ATTEMPTS = 5;

type AttemptStore = Map<string, number[]>;

const globalAccountSecurity = globalThis as typeof globalThis & {
  passwordChangeAttempts?: AttemptStore;
};

const passwordChangeAttempts =
  globalAccountSecurity.passwordChangeAttempts ?? new Map<string, number[]>();

if (process.env.NODE_ENV !== "production") {
  globalAccountSecurity.passwordChangeAttempts = passwordChangeAttempts;
}

function recentAttempts(userId: string, now = Date.now()) {
  const cutoff = now - PASSWORD_ATTEMPT_WINDOW_MS;
  const attempts = (passwordChangeAttempts.get(userId) ?? []).filter(
    (attempt) => attempt > cutoff,
  );
  if (attempts.length) {
    passwordChangeAttempts.set(userId, attempts);
  } else {
    passwordChangeAttempts.delete(userId);
  }
  return attempts;
}

export function passwordChangeIsRateLimited(userId: string) {
  return recentAttempts(userId).length >= MAX_PASSWORD_ATTEMPTS;
}

export function recordFailedPasswordChange(userId: string) {
  const attempts = recentAttempts(userId);
  attempts.push(Date.now());
  passwordChangeAttempts.set(userId, attempts);
}

export function clearPasswordChangeAttempts(userId: string) {
  passwordChangeAttempts.delete(userId);
}
