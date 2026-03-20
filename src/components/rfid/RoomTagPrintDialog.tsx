// @ts-nocheck
import React, { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, QrCode, Barcode, Download } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { printBarcode } from '@/util/barcode';

interface RoomTag {
  id: string;
  tagId: string;
  zoneName: string;
  floorNumber: string | null;
  roomNumber: string | null;
  building: string | null;
}

interface RoomTagPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomTag: RoomTag | null;
}

export function RoomTagPrintDialog({ open, onOpenChange, roomTag }: RoomTagPrintDialogProps) {
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrCodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [activeCode, setActiveCode] = useState<'barcode' | 'qrcode'>('qrcode');
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!roomTag || !open) return;

    // Generate barcode
    if (barcodeCanvasRef.current) {
      try {
        const canvas = barcodeCanvasRef.current;
        JsBarcode(canvas, roomTag.tagId, {
          format: 'CODE128',
          lineColor: '#000',
          width: 2,
          height: 80,
          displayValue: true,
          text: roomTag.tagId,
          fontSize: 14,
          margin: 10,
          background: '#fff',
        });
        setBarcodeDataUrl(canvas.toDataURL('image/png'));
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }

    // Generate QR code
    if (qrCodeCanvasRef.current) {
      QRCode.toDataURL(roomTag.tagId, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((dataUrl) => {
          setQrCodeDataUrl(dataUrl);
        })
        .catch((error) => {
          console.error('Error generating QR code:', error);
        });
    }
  }, [roomTag, open]);

  const handlePrint = async () => {
    if (!roomTag) return;

    const locationText = [
      roomTag.building,
      `Floor ${roomTag.floorNumber}`,
      `Room ${roomTag.roomNumber}`,
    ]
      .filter(Boolean)
      .join(' · ');

    await printBarcode(
      roomTag.tagId,
      roomTag.tagId,
      `Room RFID Tag`,
      locationText,
      activeCode
    );
  };

  if (!roomTag) return null;

  const locationText = [
    roomTag.building,
    `Floor ${roomTag.floorNumber}`,
    `Room ${roomTag.roomNumber}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Print Room RFID Tag</DialogTitle>
          <DialogDescription>
            {locationText} · Tag ID: {roomTag.tagId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Code type selector */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={activeCode === 'barcode' ? 'default' : 'outline'}
              onClick={() => setActiveCode('barcode')}
              className="flex-1"
            >
              <Barcode className="h-4 w-4 mr-2" />
              Barcode
            </Button>
            <Button
              type="button"
              variant={activeCode === 'qrcode' ? 'default' : 'outline'}
              onClick={() => setActiveCode('qrcode')}
              className="flex-1"
            >
              <QrCode className="h-4 w-4 mr-2" />
              QR Code
            </Button>
          </div>

          {/* Preview */}
          <div className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-8 flex flex-col items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4 w-full max-w-md">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {roomTag.zoneName}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {locationText}
              </p>

              {activeCode === 'barcode' ? (
                <div className="mt-6">
                  <canvas
                    ref={barcodeCanvasRef}
                    className="max-w-full h-auto"
                    style={{ display: barcodeDataUrl ? 'block' : 'none' }}
                  />
                  {!barcodeDataUrl && (
                    <div className="text-sm text-slate-400">Generating barcode...</div>
                  )}
                </div>
              ) : (
                <div className="mt-6">
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code"
                      className="mx-auto max-w-full h-auto"
                    />
                  ) : (
                    <div className="text-sm text-slate-400">Generating QR code...</div>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {roomTag.tagId}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handlePrint} className="flex-1" size="lg">
              <Printer className="h-4 w-4 mr-2" />
              Print {activeCode === 'barcode' ? 'Barcode' : 'QR Code'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              size="lg"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
