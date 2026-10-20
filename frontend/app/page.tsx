'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';

export default function Home() {
  const { user, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady) router.replace(user ? '/boards' : '/login');
  }, [isReady, user, router]);

  return (
    <main className="splash">
      <div className="brand splash-brand">
        <Image src="/fb-icon.png" alt="Flowboard" width={30} height={30} />
        <strong>Flowboard</strong>
      </div>
    </main>
  );
}
