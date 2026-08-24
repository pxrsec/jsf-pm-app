import { z } from "zod";

const ISO_OFFSET_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

const MAX_RANGE_MS = 93 * 24 * 60 * 60 * 1000;

export const adminAuditQuerySchema = z
  .object({
    from: z
      .string()
      .regex(
        ISO_OFFSET_DATETIME_REGEX,
        "from must be an offset-bearing ISO 8601 string",
      ),
    to: z
      .string()
      .regex(
        ISO_OFFSET_DATETIME_REGEX,
        "to must be an offset-bearing ISO 8601 string",
      ),
  })
  .refine(
    (data) => {
      const fromMs = Date.parse(data.from);
      const toMs = Date.parse(data.to);
      if (isNaN(fromMs) || isNaN(toMs)) return false;
      return fromMs < toMs;
    },
    { message: "from must precede to", path: ["from"] },
  )
  .refine(
    (data) => {
      const fromMs = Date.parse(data.from);
      const toMs = Date.parse(data.to);
      if (isNaN(fromMs) || isNaN(toMs)) return false;
      return toMs - fromMs <= MAX_RANGE_MS;
    },
    { message: "Audit range must not exceed 93 days", path: ["to"] },
  );

export const adminAuditCursorSchema = z
  .object({
    beforeCreatedAt: z.string().regex(ISO_OFFSET_DATETIME_REGEX),
    beforeAuditId: z.number().int().nonnegative(),
  })
  .nullable();

export const adminUserInvitationCursorSchema = z
  .object({
    beforeCreatedAt: z.string().regex(ISO_OFFSET_DATETIME_REGEX),
    beforeProfileId: z.string().uuid(),
  })
  .nullable();
