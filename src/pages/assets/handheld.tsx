// @ts-nocheck
/**
 * Standalone handheld scanner page for "Add to home screen" / field use.
 * Minimal chrome, full-width scanner-first UI. Requires auth.
 */
import { DashboardLayout } from '@/components/DashboardLayout';
import HandheldAssetScanner from '@/components/HandheldAssetScanner';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

export default function AssetsHandheldPage() {
  const router = useRouter();

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto w-full px-2 py-4">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/assets')}
            className="shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm text-muted-foreground">Back to Assets</span>
        </div>
        <HandheldAssetScanner standalone />
      </div>
    </DashboardLayout>
  );
}
