import { ckanAction } from "./http/ckanAction.js";

export async function addMember(action, body) {
  try {
    await ckanAction(action, body);
  } catch (error) {
    const msg = String(error?.message || "").toLowerCase();
    if (msg.includes("missing value") && msg.includes("role")) {
      const fallbackBody = { ...body };
      if (fallbackBody.capacity && !fallbackBody.role) {
        fallbackBody.role = fallbackBody.capacity;
      }
      delete fallbackBody.capacity;
      await ckanAction(action, fallbackBody);
      return;
    }
    if (msg.includes("already") && msg.includes("member")) return;
    throw error;
  }
}

export async function removeMember(action, body) {
  try {
    await ckanAction(action, body);
  } catch (error) {
    const msg = String(error?.message || "").toLowerCase();
    const ignorable =
      msg.includes("not a member") ||
      msg.includes("not member") ||
      msg.includes("does not exist") ||
      msg.includes("cannot find");
    if (ignorable) return;
    throw error;
  }
}
