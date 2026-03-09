import { z } from "zod";

// Reusable primitives keep validation consistent across auth/profile handlers.
const email = z.string().trim().email();
const role = z.enum(["student", "faculty", "admin"]);

/**
 * Registration payload validator.
 *
 * Expected by `/api/auth/register` route.
 */
export const registerSchema = z.object({
  full_name: z.string().trim().min(3),
  email,
  password: z.string().min(8),
  role,
  department: z.string().trim().optional().nullable(),
  ckan_org_id: z.string().trim().optional().nullable(),
  ckan_group_id: z.string().trim().optional().nullable(),
});

/**
 * Login payload validator.
 *
 * Expected by `/api/auth/login` route.
 */
export const loginSchema = z.object({
  email,
  password: z.string().min(1),
});

/**
 * Forgot-password payload validator.
 *
 * Expected by `/api/auth/forgot-password` route.
 */
export const forgotPasswordSchema = z.object({
  email,
});

/**
 * Reset-password payload validator.
 *
 * Expected by `/api/auth/reset-password` route.
 */
export const resetPasswordSchema = z.object({
  token: z.string().trim().min(16),
  password: z.string().min(8),
});

/**
 * Authenticated change-password payload validator.
 *
 * Expected by `/api/auth/change-password` route.
 */
export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
  confirm_password: z.string().min(1),
});

/**
 * Affiliate profile patch payload validator.
 *
 * Expected by `/api/affiliate-profile/me` PATCH route.
 */
export const affiliateProfileUpdateSchema = z.object({
  full_name: z.string().trim().min(3).optional().nullable(),
  department: z.string().trim().max(160).optional().nullable(),
  ckan_org_id: z.string().trim().optional().nullable(),
  ckan_group_id: z.string().trim().optional().nullable(),
  google_scholar_link: z.string().trim().url().optional().nullable(),
  employment_status: z.string().trim().max(160).optional().nullable(),
  designation: z.string().trim().max(160).optional().nullable(),
  is_gs_faculty: z.boolean().optional(),
});

/**
 * Parses input with a given Zod schema or throws a user-facing error.
 *
 * System flow:
 * - Attempt safe parse.
 * - Return parsed value on success.
 * - Throw first validation message (or fallback) on failure.
 *
 * Dependency:
 * - Route handlers catch thrown errors and map them to HTTP responses.
 */
export function parseOrThrow(schema, input, fallbackMessage) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issue = result.error.issues?.[0];
  throw new Error(issue?.message || fallbackMessage);
}
