import { z } from 'zod';

export const loginSchema = z.object({
  login_username: z.string().min(1, 'Username or email is required.'),
  login_password: z.string().min(1, 'Password is required.'),
  remember_me: z.string().optional(),
});

// Mirrors the legacy `register.html` field set (`register_*`/plain names mixed, exactly as
// legacy named them) — firstname/lastname/email/phone/country/city/address are required
// there; state/postalcode/privatenumber are not (only required when country is US, a rule
// this pass doesn't enforce yet, same documented simplification as the bema address forms).
export const registerSchema = z
  .object({
    register_firstname: z.string().min(1, 'First name is required.').max(50),
    register_lastname: z.string().min(1, 'Last name is required.').max(50),
    register_emailaddress: z.string().email('A valid email is required.').max(100),
    phone: z.string().min(1, 'Cell phone is required.').max(50),
    country: z.string().min(1, 'Country is required.'),
    city: z.string().min(1, 'City is required.').max(50),
    state: z.string().max(50).optional(),
    postalcode: z.string().max(20).optional(),
    address: z.string().min(1, 'Address is required.').max(100),
    register_privatenumber: z.string().max(11).optional(),
    register_password: z.string().min(8, 'Password must be at least 8 characters.'),
    register_passwordverify: z.string(),
    language: z.enum(['en', 'ge']).optional(),
    // Legacy: `<input type="checkbox" name="register_terms" value="1" required>` — a native
    // unchecked checkbox is simply absent from FormData, not `false`, so this is a literal
    // match on the checked value rather than `z.boolean()`.
    register_terms: z.literal('1', { error: 'You must agree to the Terms & Conditions and Privacy Policy.' }),
  })
  .refine((data) => data.register_password === data.register_passwordverify, {
    message: 'Passwords do not match.',
    path: ['register_passwordverify'],
  });

export const forgotPasswordSchema = z.object({
  forgot_username: z.string().email('A valid email is required.'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    reset_password: z.string().min(8, 'Password must be at least 8 characters.'),
    reset_passwordverify: z.string(),
  })
  .refine((data) => data.reset_password === data.reset_passwordverify, {
    message: 'Passwords do not match.',
    path: ['reset_passwordverify'],
  });
