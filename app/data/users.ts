import { randomUUID } from "node:crypto";
import { kvKey, openKv, readLocal, writeLocal } from "./kv.ts";

export type Passkey = {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  label: string;
  createdAt: string;
};

export type DeviceInvite = {
  id: string;
  createdAt: string;
  expiresAt: string;
  claimedAt: string | null;
};

export type User = {
  id: string;
  createdAt: string;
  passkeys: Passkey[];
  deviceInvites: DeviceInvite[];
  shareInviteIds: string[];
};

export type InviteLookup = Pick<DeviceInvite, "expiresAt" | "claimedAt"> & { userId: string };

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function getUser(id: string): Promise<User | null> {
  const kv = await openKv();
  if (kv) {
    const user = (await kv.get<User>(kvKey("user", id))).value;
    return user
      ? {
          ...user,
          deviceInvites: user.deviceInvites ?? [],
          shareInviteIds: user.shareInviteIds ?? [],
        }
      : null;
  }
  const user = ((await readLocal()).users[id] as User | undefined) ?? null;
  return user
    ? {
        ...user,
        deviceInvites: user.deviceInvites ?? [],
        shareInviteIds: user.shareInviteIds ?? [],
      }
    : null;
}

export async function saveUser(user: User) {
  const kv = await openKv();
  if (kv) {
    await kv.set(kvKey("user", user.id), user);
    return;
  }
  const store = await readLocal();
  store.users[user.id] = user;
  await writeLocal(store);
}

export async function findUserId(credentialId: string): Promise<string | null> {
  const kv = await openKv();
  if (kv) return (await kv.get<string>(kvKey("cred", credentialId))).value;
  const store = await readLocal();
  return store.credIndex[credentialId] ?? null;
}

export async function createUser(passkey: Passkey, id?: string) {
  const user: User = {
    id: id ?? randomUUID(),
    createdAt: new Date().toISOString(),
    passkeys: [passkey],
    deviceInvites: [],
    shareInviteIds: [],
  };
  await saveUser(user);
  const kv = await openKv();
  if (kv) await kv.set(kvKey("cred", passkey.credentialId), user.id);
  else {
    const store = await readLocal();
    store.credIndex[passkey.credentialId] = user.id;
    await writeLocal(store);
  }
  return user;
}

export async function updateCounter(user: User, credentialId: string, counter: number) {
  await saveUser({
    ...user,
    passkeys: user.passkeys.map((p) => (p.credentialId === credentialId ? { ...p, counter } : p)),
  });
}

export async function addPasskeyToUser(userId: string, passkey: Passkey): Promise<User | null> {
  const user = await getUser(userId);
  if (!user) return null;
  if (user.passkeys.some((entry) => entry.credentialId === passkey.credentialId)) return user;
  const next = { ...user, passkeys: [...user.passkeys, passkey] };
  await saveUser(next);
  const kv = await openKv();
  if (kv) await kv.set(kvKey("cred", passkey.credentialId), userId);
  else {
    const store = await readLocal();
    store.credIndex[passkey.credentialId] = userId;
    await writeLocal(store);
  }
  return next;
}

export async function createDeviceInvite(userId: string): Promise<DeviceInvite | null> {
  const user = await getUser(userId);
  if (!user) return null;
  const invite: DeviceInvite = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    claimedAt: null,
  };
  await saveUser({ ...user, deviceInvites: [...user.deviceInvites, invite] });
  const lookup = { userId, expiresAt: invite.expiresAt, claimedAt: null };
  const kv = await openKv();
  if (kv) await kv.set(kvKey("invite", invite.id), lookup);
  else {
    const store = await readLocal();
    store.inviteIndex[invite.id] = lookup;
    await writeLocal(store);
  }
  return invite;
}

export async function getDeviceInvite(inviteId: string): Promise<InviteLookup | null> {
  const kv = await openKv();
  if (kv) return (await kv.get<InviteLookup>(kvKey("invite", inviteId))).value;
  const store = await readLocal();
  const indexed = store.inviteIndex[inviteId] as InviteLookup | undefined;
  if (indexed) return indexed;
  for (const candidate of Object.values(store.users)) {
    const user = candidate as User;
    const invite = user.deviceInvites?.find((entry) => entry.id === inviteId);
    if (invite)
      return { userId: user.id, expiresAt: invite.expiresAt, claimedAt: invite.claimedAt };
  }
  return null;
}

export async function claimDeviceInvite(
  inviteId: string,
  passkey: Passkey,
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const invite = await getDeviceInvite(inviteId);
  if (!invite) return { ok: false, error: "Invite not found" };
  if (invite.claimedAt) return { ok: false, error: "Invite already used" };
  if (Date.parse(invite.expiresAt) < Date.now()) return { ok: false, error: "Invite expired" };
  const user = await addPasskeyToUser(invite.userId, passkey);
  if (!user) return { ok: false, error: "User not found" };
  const claimedAt = new Date().toISOString();
  const next = {
    ...user,
    deviceInvites: user.deviceInvites.map((entry) =>
      entry.id === inviteId ? { ...entry, claimedAt } : entry,
    ),
  };
  await saveUser(next);
  const lookup = { ...invite, claimedAt };
  const kv = await openKv();
  if (kv) await kv.set(kvKey("invite", inviteId), lookup);
  else {
    const store = await readLocal();
    store.inviteIndex[inviteId] = lookup;
    await writeLocal(store);
  }
  return { ok: true, user: next };
}

export async function revokeDeviceInvite(
  userId: string,
  inviteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getUser(userId);
  const invite = user?.deviceInvites.find((entry) => entry.id === inviteId);
  if (!user || !invite) return { ok: false, error: "Invite not found" };
  if (invite.claimedAt) return { ok: false, error: "Invite already used" };
  await saveUser({
    ...user,
    deviceInvites: user.deviceInvites.filter((entry) => entry.id !== inviteId),
  });
  const kv = await openKv();
  if (kv) await kv.delete?.(kvKey("invite", inviteId));
  else {
    const store = await readLocal();
    delete store.inviteIndex[inviteId];
    await writeLocal(store);
  }
  return { ok: true };
}

export function listPendingDeviceInvites(user: User): DeviceInvite[] {
  return user.deviceInvites.filter(
    (invite) => invite.claimedAt == null && Date.parse(invite.expiresAt) >= Date.now(),
  );
}

export async function ensureDevUser(): Promise<User> {
  const existing = await getUser("dev-user");
  if (existing) return existing;
  const user: User = {
    id: "dev-user",
    createdAt: new Date().toISOString(),
    passkeys: [],
    deviceInvites: [],
    shareInviteIds: [],
  };
  await saveUser(user);
  return user;
}
