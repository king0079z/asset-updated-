import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function DepartmentsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings?tab=departments'); }, [router]);
  return <div className="min-h-[50vh] flex items-center justify-center text-sm text-muted-foreground">Redirecting…</div>;
}
