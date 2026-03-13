import { z } from "zod";

// Reusable primitives keep validation consistent across auth/profile handlers.
const email = z.string().trim().email();
const role = z.enum(["student", "faculty", "admin"]);
const optionalEmail = z.preprocess((value) => {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}, z.string().email().nullable().optional());

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

export const awardRecognitionSchema = z.object({
  work_title: z.string().trim().min(1),
  award_recognition: z.string().trim().min(1),
  awarding_body: z.string().trim().min(1),
  year_received: z
    .union([z.string().trim(), z.number().int()])
    .transform((value) => String(value).trim())
    .refine((value) => /^\d{4}$/.test(value), "Year received must be a 4-digit year."),
  level: z.string().trim().min(1),
  recipients: z.string().trim().min(1),
  recipient_users: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1),
        username: z.string().trim().optional().nullable(),
        email: optionalEmail,
      }),
    )
    .optional()
    .nullable(),
  supporting_movs: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  research_center_id: z.string().trim().min(1),
  department_id: z.string().trim().optional().nullable(),
  program_department: z.string().trim().optional().nullable(),
});

export const adminCreateProponentSchema = z.object({
  full_name: z.string().trim().min(3),
  email,
  role: z.enum(["student", "faculty"]),
  ckan_org_id: z.string().trim().optional().nullable(),
  ckan_group_id: z.string().trim().optional().nullable(),
  department: z.string().trim().optional().nullable(),
});

const submissionSelectedUserSchema = z.object({
  id: z.string().trim().optional().nullable(),
  name: z.string().trim().min(1, "Selected user name is required."),
  username: z.string().trim().optional().nullable(),
  email: optionalEmail,
  role: z.string().trim().optional().nullable(),
});

const submissionExpectedOutputSchema = z
  .object({
    output_type: z.enum(
      [
        "publication",
        "patent_ip",
        "people_services",
        "places_partnerships",
        "policies",
        "product_software",
        "others",
      ],
      { errorMap: () => ({ message: "Each expected output must have a valid type." }) },
    ),
    target_count: z
      .coerce
      .number()
      .int()
      .min(1, "Each expected output must have a target count of at least 1."),
    notes: z.string().trim().optional().nullable(),
    file_path: z.string().trim().optional().nullable(),
    file_name: z.string().trim().optional().nullable(),
    file_size: z.coerce.number().min(0).optional().nullable(),
    mime_type: z.string().trim().optional().nullable(),
    specific_output: z.string().trim().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (
      value.output_type === "product_software" &&
      !String(value.specific_output || "").trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Specific output is required for Product/Software Application.",
        path: ["specific_output"],
      });
    }
  });

const projectSubmissionFormSchema = z
  .object({
    title: z.string().trim().min(1, "Project title is required."),
    lead_researcher: z.string().trim().min(1, "Lead researcher is required."),
    lead_researcher_user: submissionSelectedUserSchema.optional().nullable(),
    faculty_team: z
      .string()
      .trim()
      .min(1, "Research team (faculty) is required."),
    faculty_team_users: z
      .array(submissionSelectedUserSchema)
      .optional()
      .nullable()
      .transform((value) => (Array.isArray(value) ? value : [])),
    student_team: z.string().trim().optional().nullable(),
    abstract: z.string().trim().optional().nullable(),
    year: z.coerce
      .number()
      .int()
      .min(2000, "Project year must be between 2000 and 2100.")
      .max(2100, "Project year must be between 2000 and 2100."),
    research_center_id: z
      .string()
      .trim()
      .min(1, "Research center (CKAN organization) is required."),
    research_agenda_id: z
      .string()
      .trim()
      .min(1, "Research agenda is required."),
    department_id: z.string().trim().min(1, "Department is required."),
    scholarly_type: z.string().trim().min(1, "Scholarly type is required."),
    funding_type: z.string().trim().min(1, "Funding type is required."),
    funding_category: z.string().trim().optional().nullable(),
    industry_partner: z.string().trim().optional().nullable(),
    funding_source: z.string().trim().optional().nullable(),
    funding_amount: z.coerce
      .number()
      .min(0, "Funding amount cannot be negative."),
    classification: z.string().trim().min(1, "Classification is required."),
    status: z.string().trim().min(1, "Status is required."),
    expected_outputs: z.string().trim().optional().nullable(),
    supporting_mov_link: z
      .string()
      .trim()
      .url("Supporting MOV link must be a valid URL.")
      .optional()
      .nullable()
      .or(z.literal("")),
    signed_moa_reference: z.string().trim().optional().nullable(),
    start_date: z.string().trim().min(1, "Start date is required."),
    end_date: z.string().trim().min(1, "End date is required."),
    public_visible: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.start_date && Number.isNaN(Date.parse(value.start_date))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start date is invalid.",
        path: ["start_date"],
      });
    }
    if (value.end_date && Number.isNaN(Date.parse(value.end_date))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date is invalid.",
        path: ["end_date"],
      });
    }
    if (
      value.start_date &&
      value.end_date &&
      !Number.isNaN(Date.parse(value.start_date)) &&
      !Number.isNaN(Date.parse(value.end_date)) &&
      value.start_date > value.end_date
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date cannot be earlier than start date.",
        path: ["end_date"],
      });
    }

    const fundingType = String(value.funding_type || "")
      .trim()
      .toLowerCase();
    const fundingCategory = String(value.funding_category || "")
      .trim()
      .toLowerCase();
    if (fundingType !== "none" && !String(value.funding_source || "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Funding source is required when funding type is selected.",
        path: ["funding_source"],
      });
    }
    if (
      fundingType.includes("industry") ||
      fundingCategory.includes("industry")
    ) {
      if (!String(value.industry_partner || "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Industry partner is required for industry-funded projects.",
          path: ["industry_partner"],
        });
      }
    }
  });

export const projectSubmissionPublishSchema = z.object({
  dataset_id: z.string().trim().optional().nullable(),
  form: projectSubmissionFormSchema,
  expected_outputs: z.array(submissionExpectedOutputSchema).optional().default([]),
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
