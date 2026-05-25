import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(100, "Name must be at most 100 characters.");

const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Full name is required.")
  .max(100, "Full name must be at most 100 characters.");

const addressSchema = z
  .string()
  .trim()
  .max(300, "Address must be at most 300 characters.")
  .optional()
  .or(z.literal(""));

const contactInfoSchema = z
  .string()
  .trim()
  .max(300, "Contact info must be at most 300 characters.")
  .optional()
  .or(z.literal(""));

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Please provide a valid email.")
  .max(254, "Email is too long.");

const passwordSchema = z
  .string()
  .trim()
  .min(8, "Temporary password must be at least 8 characters.")
  .max(128, "Temporary password must be at most 128 characters.");

const uuidSchema = z.string().uuid("Invalid UUID format.");

const fatherNameSchema = z
  .string()
  .trim()
  .min(1, "Father's name is required.")
  .max(100, "Father's name must be at most 100 characters.");

// Pakistani CNIC format: 0000-0000000-0
const cnicSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{7}-\d$/, "CNIC must be in format: 0000-0000000-0");

const shortTextSearchSchema = z
  .string()
  .trim()
  .max(100, "Search query must be at most 100 characters.")
  .optional()
  .or(z.literal(""));

const pageSchema = z.coerce.number().int().min(1).max(100000).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(10);

export const adminCreateSchoolSchema = z.object({
  name: nameSchema,
  address: addressSchema,
  contact_info: contactInfoSchema,
  email: emailSchema,
  temporary_password: passwordSchema,
});

export const adminCreateInstituteSchema = z.object({
  name: nameSchema,
  institute_type_id: uuidSchema,
  address: addressSchema,
  contact_info: contactInfoSchema,
  email: emailSchema,
  temporary_password: passwordSchema,
});

export const adminCreateStudentSchema = z.object({
  full_name: fullNameSchema,
  email: emailSchema,
  school_id: uuidSchema,
  temporary_password: passwordSchema,
  father_name: fatherNameSchema,
  father_cnic: cnicSchema,
});

export const adminStudentIdParamsSchema = z.object({
  id: uuidSchema,
});

export const schoolStudentListQuerySchema = z.object({
  q: shortTextSearchSchema,
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export const schoolCreateStudentSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  temporaryPassword: passwordSchema,
  fatherName: fatherNameSchema,
  fatherCnic: cnicSchema,
});

export const schoolStudentIdParamsSchema = z.object({
  id: uuidSchema,
});

export const schoolUpdateStudentSchema = z.object({
  fullName: fullNameSchema,
});

export function getZodErrorMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request data.";
}
