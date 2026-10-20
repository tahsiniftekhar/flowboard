import { Suspense } from 'react';

import { Dashboard } from '@/components/dashboard/dashboard';

export const metadata = { title: 'Boards · Flowboard' };

export default function BoardsPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
