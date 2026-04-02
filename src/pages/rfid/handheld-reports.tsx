// Redirects to the combined Handheld Audit page
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function HandheldReportsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/audit'); }, []);
  return null;
}
