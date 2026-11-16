"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-client";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { useDashboard } from "@/components/DashboardProvider";

interface SubAdmin {
  uid: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: number;
}

function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Your current password is incorrect.";
    case "auth/email-already-in-use":
      return "That email is already used by another account.";
    case "auth/invalid-email":
      return "That email address is not valid.";
    case "auth/weak-password":
      return "The new password must be at least 6 characters.";
    case "auth/requires-recent-login":
      return "Please sign in again, then retry this change.";
    default:
      return (err as Error)?.message ?? "Something went wrong.";
  }
}

export default function AccountPage() {
  const { account, loading, error: accountError, reload } = useDashboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-sm text-slate-500">
          Manage your profile, sign-in details and team access.
        </p>
      </div>

      {accountError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{accountError}</p>
      )}
      {loading && <p className="text-sm text-slate-500">Loading account…</p>}

      {account && (
        <>
          <ProfileSection
            name={account.name}
            email={account.email}
            role={account.role}
            onSaved={reload}
          />
          <EmailSection email={account.email} onSaved={reload} />
          <PasswordSection email={account.email} />
          {account.role === "owner" ? (
            <TeamSection />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Team</h2>
              <p className="mt-2 text-sm text-slate-500">
                Only the account owner can add or deactivate sub-admins.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const buttonClass =
  "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60";

function ProfileSection({
  name,
  email,
  role,
  onSaved,
}: {
  name: string;
  email: string;
  role: "owner" | "admin";
  onSaved: () => void;
}) {
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiPatch("/api/account", { name: value.trim() });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Profile" description={`Signed in as ${email} · ${role}`}>
      <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="profile-name" className="block text-sm font-medium text-slate-700">
            Display name
          </label>
          <input
            id="profile-name"
            type="text"
            required
            maxLength={60}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={saving || value.trim() === name || value.trim().length === 0}
          className={buttonClass}
        >
          {saving ? "Saving…" : "Save name"}
        </button>
      </form>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Profile updated.
        </p>
      )}
    </Section>
  );
}

function EmailSection({ email, onSaved }: { email: string; onSaved: () => void }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const user = getClientAuth().currentUser;
      if (!user || !user.email) throw new Error("Not signed in.");
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, password));
      await updateEmail(user, newEmail.trim());
      await user.getIdToken(true);
      await apiPatch("/api/account", { syncEmail: true });
      setSaved(true);
      setNewEmail("");
      setPassword("");
      onSaved();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Email address" description={`Current: ${email}`}>
      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="new-email" className="block text-sm font-medium text-slate-700">
            New email
          </label>
          <input
            id="new-email"
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="email-password" className="block text-sm font-medium text-slate-700">
            Current password
          </label>
          <input
            id="email-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className={buttonClass}>
            {saving ? "Updating…" : "Change email"}
          </button>
        </div>
      </form>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Email updated. Use the new address at your next sign-in.
        </p>
      )}
    </Section>
  );
}

function PasswordSection({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (next.length < 8) {
      setError("The new password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const user = getClientAuth().currentUser;
      if (!user || !user.email) throw new Error("Not signed in.");
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, current));
      await updatePassword(user, next);
      setSaved(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Password" description="Choose a new password for your account.">
      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="current-password" className="block text-sm font-medium text-slate-700">
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
            New password (min 8)
          </label>
          <input
            id="new-password"
            type="password"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-3">
          <button type="submit" disabled={saving} className={buttonClass}>
            {saving ? "Updating…" : "Change password"}
          </button>
        </div>
      </form>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Password updated.
        </p>
      )}
    </Section>
  );
}

function TeamSection() {
  const [subAdmins, setSubAdmins] = useState<SubAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<SubAdmin | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet("/api/account/sub-admins");
      setSubAdmins(data.subAdmins as SubAdmin[]);
      setError(null);
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to load sub-admins.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    setCreated(null);
    try {
      const { data } = await apiPost("/api/account/sub-admins", { name, email, password });
      setCreated(data as SubAdmin);
      setName("");
      setEmail("");
      setPassword("");
      await load();
    } catch (err) {
      setCreateError((err as Error)?.message ?? "Failed to create sub-admin.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(sub: SubAdmin) {
    setBusyUid(sub.uid);
    setError(null);
    try {
      await apiPatch(`/api/account/sub-admins/${sub.uid}`, { active: !sub.active });
      await load();
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to update sub-admin.");
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <Section
      title="Sub-admins"
      description="Sub-admins can sign in, create products and batches, and view analytics. They cannot change the owner account or manage other sub-admins."
    >
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {subAdmins === null ? (
        <p className="text-sm text-slate-500">Loading sub-admins…</p>
      ) : subAdmins.length === 0 ? (
        <p className="text-sm text-slate-500">No sub-admins yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {subAdmins.map((sub) => (
            <li key={sub.uid} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">
                  {sub.name}{" "}
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      sub.active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {sub.active ? "active" : "deactivated"}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  {sub.email} · added {new Date(sub.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleActive(sub)}
                disabled={busyUid !== null}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
                  sub.active
                    ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
                    : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                {busyUid === sub.uid ? "Saving…" : sub.active ? "Deactivate" : "Reactivate"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={handleCreate}
        className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3"
      >
        <div>
          <label htmlFor="sub-name" className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="sub-name"
            type="text"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="sub-email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="sub-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="sub-password" className="block text-sm font-medium text-slate-700">
            Temporary password (min 6)
          </label>
          <input
            id="sub-password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-3">
          <button type="submit" disabled={creating} className={buttonClass}>
            {creating ? "Creating…" : "Add sub-admin"}
          </button>
        </div>
      </form>

      {createError && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</p>
      )}
      {created && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Sub-admin {created.email} created. Share the temporary password with them. They can
          change it after signing in.
        </p>
      )}
    </Section>
  );
}
