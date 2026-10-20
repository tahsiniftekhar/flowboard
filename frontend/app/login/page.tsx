import { Suspense } from 'react';

import { AuthForm } from '@/components/auth/auth-form';

export const metadata = { title: 'Log in · Flowboard' };

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
