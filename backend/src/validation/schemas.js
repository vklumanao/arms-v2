import { z } from "zod";

const email = z.string().trim().email();
const role = z.enum(["student", "faculty", "admin"]);

export const registerSchema = z.object({
  full_name: z.string().trim().min(3),
  email,
  password: z.string().min(8),
  role,
  department: z.string().trim().optional().nullable(),
  ckan_org_id: z.string().trim().min(1),
  ckan_group_id: z.string().trim().optional().nullable(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(16),
  password: z.string().min(8),
});

export const affiliateProfileUpdateSchema = z.object({
  full_name: z.string().trim().min(3).optional().nullable(),
  google_scholar_link: z.string().trim().url().optional().nullable(),
  employment_status: z.string().trim().max(160).optional().nullable(),
  designation: z.string().trim().max(160).optional().nullable(),
  is_gs_faculty: z.boolean().optional(),
});

export function parseOrThrow(schema, input, fallbackMessage) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issue = result.error.issues?.[0];
  throw new Error(issue?.message || fallbackMessage);
}
