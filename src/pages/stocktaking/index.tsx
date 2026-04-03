import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function StocktakingRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/assets'); }, []);
  return null;
}
