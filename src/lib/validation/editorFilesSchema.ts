import { z } from 'zod';

// bema "Files" (`bema/files.cfm`) — see docs/decisions/0032-bema-files.md.

// Legacy's own create-folder check: `reFindNoCase("[^A-Za-z0-9\-_]", form.folder) gt 0` is
// invalid, and the input has `maxlength="25"`.
export const folderNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Folder name is required.')
    .max(25, 'Folder name is too long (max 25 characters).')
    .regex(/^[A-Za-z0-9_-]+$/, 'Folder name is invalid.'),
});

export const listFilesQuerySchema = z.object({
  folder: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(10),
  dir: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().optional(),
});

// Legacy's upload validation: a file is required, and if "resize" is checked, at least one
// of width/height must be given.
export const uploadFileParamsSchema = z
  .object({
    folder: z.string().min(1),
    resize: z.coerce.boolean().optional().default(false),
    width: z.coerce.number().int().min(0).optional().default(0),
    height: z.coerce.number().int().min(0).optional().default(0),
  })
  .refine((data) => !data.resize || data.width > 0 || data.height > 0, {
    message: 'You need to specify either a width or a height if you want to resize the image.',
    path: ['width'],
  });
