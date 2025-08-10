import AdminDashboard from '@/components/AdminDashboard';

export const metadata = {
  title: 'Admin Dashboard - URL Shortener',
  description: 'Manage your shortened URLs and view analytics',
};

export default function AdminPage() {
  return <AdminDashboard />;
}