import { redirect } from 'next/navigation';
import { routes } from '@/lib/routes';

// `/bema` itself has no content — this just sends visitors to the login page (the
// client-side auth guard in `(protected)/layout.tsx` then forwards logged-in visitors
// wherever they were headed).
export default function BemaIndexPage() {
  redirect(routes.bema.login());
}
