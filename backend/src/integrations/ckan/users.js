import crypto from "node:crypto";
import { config } from "../../config/index.js";
import { ckanAction } from "./http/ckanAction.js";
import { safeSlug } from "./utils/normalize.js";

export async function listUsers() {
  return ckanAction("user_list", {
    all_fields: true,
    include_site_user: true,
  });
}

async function getUserByName(username) {
  try {
    return await ckanAction("user_show", { id: username });
  } catch {
    return null;
  }
}

async function getUserByEmail(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  try {
    const users = await ckanAction("user_list", {
      all_fields: true,
      include_site_user: true,
    });
    const list = Array.isArray(users) ? users : [];
    return (
      list.find(
        (user) =>
          String(user?.email || "")
            .trim()
            .toLowerCase() === normalized,
      ) || null
    );
  } catch {
    return null;
  }
}

function usernameFromEmail(email) {
  const [local] = String(email || "")
    .toLowerCase()
    .split("@");
  return safeSlug(local || "user");
}

export async function createOrGetUser({ email, fullName, password }) {
  const existingByEmail = await getUserByEmail(email);
  if (existingByEmail?.name) {
    return existingByEmail;
  }

  const base = usernameFromEmail(email);
  const candidates = [
    base,
    `${base}-${crypto.randomBytes(2).toString("hex")}`,
    `${base}-${crypto.randomBytes(3).toString("hex")}`,
  ];

  for (const candidate of candidates) {
    const existing = await getUserByName(candidate);
    if (existing?.name === candidate) {
      continue;
    }

    try {
      const created = await ckanAction("user_create", {
        name: candidate,
        email,
        fullname: fullName,
        password,
      });
      return created;
    } catch (error) {
      const msg = String(error?.message || "").toLowerCase();
      const recoverable =
        msg.includes("not available") ||
        msg.includes("already exists") ||
        msg.includes("already in use");
      if (msg.includes("email") && msg.includes("already")) {
        const user = await getUserByEmail(email);
        if (user?.name) return user;
      }
      if (!recoverable) throw error;
    }
  }

  throw new Error("Unable to create CKAN user with a unique username.");
}

export async function createApiTokenForUser(username) {
  const tokenName = `${config.ckanTokenNamePrefix}-${Date.now()}`;
  const result = await ckanAction("api_token_create", {
    user: username,
    name: tokenName,
  });

  return {
    token: result?.token,
    id: result?.id || null,
    name: tokenName,
  };
}

export async function updateCkanUserPassword(username, password) {
  await ckanAction("user_update", {
    id: username,
    password,
  });
}
