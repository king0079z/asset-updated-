import { useEffect } from 'react';
import { useRouter } from 'next/router';

/** Legacy URL — passageways live under RFID command center. */
export default function PassagewaysRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/rfid?tab=passageways');
  }, [router]);
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
      <p>Redirecting to RFID & BLE command center…</p>
    </div>
  );
}
