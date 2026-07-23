import { redirect } from 'next/navigation';

// Folded into the unified /admin dashboard (Auszahlungen tab).
export default function AdminPayoutsRedirect(): never {
  redirect('/admin?tab=payouts');
}
