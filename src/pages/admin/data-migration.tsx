import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function DataMigrationRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings?tab=migration'); }, [router]);
  return <div className="min-h-[50vh] flex items-center justify-center text-sm text-muted-foreground">Redirecting…</div>;
}
