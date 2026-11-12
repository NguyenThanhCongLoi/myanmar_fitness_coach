import type { Metadata } from 'next';
import { AdminShell } from '@/features/admin/admin-shell';
// Owner-only analytics, separate from the product UI (no link inside the app). Data access is enforced by /api/admin (ADMIN_EMAILS).
export const metadata: Metadata = { title: 'Mingalar Fit · Admin', robots: { index: false, follow: false } };
export default function AdminPage() { return <AdminShell/>; }
