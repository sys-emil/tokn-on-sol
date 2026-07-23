import { redirect } from 'next/navigation';

// Folded into the unified /admin dashboard (Veranstalter tab).
export default function AdminOrganizersRedirect(): never {
  redirect('/admin?tab=organizers');
}
