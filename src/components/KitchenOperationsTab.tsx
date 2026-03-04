// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Package, ShoppingCart, ArrowLeftRight, ClipboardList, Truck, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface KitchenOperationsTabProps {
  kitchenId: string;
  kitchenName?: string;
  allKitchens?: { id: string; name: string }[];
}


export function KitchenOperationsTab({ kitchenId, kitchenName, allKitchens = [] }: KitchenOperationsTabProps) {
  const { toast } = useToast();
  const [activeOp, setActiveOp] = useState<'batches' | 'orders' | 'transfers'>('batches');
  const [isLoading, setIsLoading] = useState(false);

  // --- Production Batches state ---
  const [batches, setBatches] = useState<any[]>([]);
  const [batchDialog, setBatchDialog] = useState(false);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [newBatch, setNewBatch] = useState({ recipeId: '', quantity: '1', scheduledDate: '', notes: '' });
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  // --- Purchase Orders state ---
  const [orders, setOrders] = useState<any[]>([]);
  const [orderDialog, setOrderDialog] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [foodSupplies, setFoodSupplies] = useState<any[]>([]);
  const [newOrder, setNewOrder] = useState({ vendorId: '', expectedDeliveryDate: '', notes: '' });
  const [orderItems, setOrderItems] = useState([{ foodSupplyId: '', quantity: '1', unitPrice: '' }]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // --- Stock Transfers state ---
  const [transfers, setTransfers] = useState<any[]>([]);
  const [transferDialog, setTransferDialog] = useState(false);
  const [newTransfer, setNewTransfer] = useState({ toKitchenId: '', notes: '' });
  const [transferItems, setTransferItems] = useState([{ foodSupplyId: '', quantity: '1' }]);
  const [isSavingTransfer, setIsSavingTransfer] = useState(false);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [bRes, oRes, tRes, rRes, vRes, fsRes] = await Promise.all([
        fetch(`/api/production-batches?kitchenId=${kitchenId}`),
        fetch(`/api/purchase-orders?kitchenId=${kitchenId}`),
        fetch(`/api/stock-transfers?kitchenId=${kitchenId}`),
        fetch('/api/recipes'),
        fetch('/api/vendors'),
        fetch('/api/food-supply'),
      ]);
      if (bRes.ok) setBatches(await bRes.json());
      if (oRes.ok) setOrders(await oRes.json());
      if (tRes.ok) setTransfers(await tRes.json());
      if (rRes.ok) setRecipes((await rRes.json()).filter((r: any) => !r.isSubrecipe));
      if (vRes.ok) setVendors(await vRes.json());
      if (fsRes.ok) setFoodSupplies(await fsRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [kitchenId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // --- Create Production Batch ---
  const handleCreateBatch = async () => {
    if (!newBatch.recipeId || !newBatch.quantity || !newBatch.scheduledDate) {
      toast({ title: 'Missing fields', description: 'Recipe, quantity, and date are required.', variant: 'destructive' });
      return;
    }
    setIsSavingBatch(true);
    try {
      const res = await fetch('/api/production-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchenId, ...newBatch }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create batch');
      }
      const batch = await res.json();
      setBatches(prev => [batch, ...prev]);
      setBatchDialog(false);
      setNewBatch({ recipeId: '', quantity: '1', scheduledDate: '', notes: '' });
      toast({ title: 'Production batch planned', description: `Batch for ${batch.recipe?.name} scheduled.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsSavingBatch(false);
    }
  };

  // --- Create Purchase Order ---
  const handleCreateOrder = async () => {
    if (!newOrder.vendorId || orderItems.some(i => !i.foodSupplyId || !i.quantity)) {
      toast({ title: 'Missing fields', description: 'Vendor and all item details are required.', variant: 'destructive' });
      return;
    }
    setIsSavingOrder(true);
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchenId, ...newOrder, items: orderItems }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create order');
      }
      const order = await res.json();
      setOrders(prev => [order, ...prev]);
      setOrderDialog(false);
      setNewOrder({ vendorId: '', expectedDeliveryDate: '', notes: '' });
      setOrderItems([{ foodSupplyId: '', quantity: '1', unitPrice: '' }]);
      toast({ title: 'Purchase order created', description: `Order to ${order.vendor?.name} submitted.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsSavingOrder(false);
    }
  };

  // --- Create Stock Transfer ---
  const handleCreateTransfer = async () => {
    if (!newTransfer.toKitchenId || transferItems.some(i => !i.foodSupplyId || !i.quantity)) {
      toast({ title: 'Missing fields', description: 'Destination kitchen and all item details are required.', variant: 'destructive' });
      return;
    }
    setIsSavingTransfer(true);
    try {
      const res = await fetch('/api/stock-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromKitchenId: kitchenId, ...newTransfer, items: transferItems }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create transfer');
      }
      const transfer = await res.json();
      setTransfers(prev => [transfer, ...prev]);
      setTransferDialog(false);
      setNewTransfer({ toKitchenId: '', notes: '' });
      setTransferItems([{ foodSupplyId: '', quantity: '1' }]);
      toast({ title: 'Stock transfer initiated', description: 'Inventory has been moved.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsSavingTransfer(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PLANNED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      IN_PROGRESS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      PENDING: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[status] || 'bg-muted text-muted-foreground'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Kitchen Operations</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Production batches, purchase orders &amp; stock transfers for{' '}
            <span className="font-semibold">{kitchenName || 'this kitchen'}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={isLoading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary stat tiles */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Planned Batches', value: batches.filter(b => b.status === 'PLANNED').length,
            icon: ClipboardList,
            gradient: 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20',
            iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400',
            bar: 'from-blue-500 to-indigo-500',
          },
          {
            label: 'Pending Orders', value: orders.filter(o => o.status === 'PENDING').length,
            icon: ShoppingCart,
            gradient: 'from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20',
            iconBg: 'bg-orange-100 dark:bg-orange-900/30', iconColor: 'text-orange-600 dark:text-orange-400',
            bar: 'from-orange-500 to-amber-500',
          },
          {
            label: 'Pending Transfers', value: transfers.filter(t => t.status === 'PENDING').length,
            icon: ArrowLeftRight,
            gradient: 'from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20',
            iconBg: 'bg-purple-100 dark:bg-purple-900/30', iconColor: 'text-purple-600 dark:text-purple-400',
            bar: 'from-purple-500 to-violet-500',
          },
        ].map(({ label, value, icon: Icon, gradient, iconBg, iconColor, bar }) => (
          <div key={label} className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${gradient} p-4 ring-1 ring-inset ring-black/5 dark:ring-white/5`}>
            <div className={`h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
              <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
            </div>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${bar}`} />
          </div>
        ))}
      </div>

      <Tabs value={activeOp} onValueChange={(v: any) => setActiveOp(v)}>
        <TabsList className="bg-muted/50 p-1 rounded-xl gap-1 h-auto">
          <TabsTrigger value="batches" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm gap-1.5 text-xs">
            <ClipboardList className="h-3.5 w-3.5" />Production
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm gap-1.5 text-xs">
            <ShoppingCart className="h-3.5 w-3.5" />Purchase Orders
          </TabsTrigger>
          <TabsTrigger value="transfers" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm gap-1.5 text-xs">
            <ArrowLeftRight className="h-3.5 w-3.5" />Stock Transfers
          </TabsTrigger>
        </TabsList>

        {/* ---- Production Batches ---- */}
        <TabsContent value="batches" className="mt-4">
          <Card className="border-0 ring-1 ring-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                  Production Batches
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{batches.length} total batches planned</p>
              </div>
              <Button size="sm" onClick={() => setBatchDialog(true)} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-3.5 w-3.5" />Plan Batch
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {batches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 rounded-xl border-2 border-dashed border-border text-center">
                  <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center mb-3">
                    <ClipboardList className="h-6 w-6 text-blue-400" />
                  </div>
                  <p className="font-medium text-sm mb-1">No production batches yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">Plan a batch to schedule recipe production in advance.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {batches.map(batch => (
                    <div key={batch.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{batch.recipe?.name || 'Unknown Recipe'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {batch.quantity} servings · {batch.startedAt ? format(new Date(batch.startedAt), 'dd MMM yyyy') : batch.createdAt ? format(new Date(batch.createdAt), 'dd MMM yyyy') : '—'}
                        </p>
                        {batch.notes && <p className="text-xs text-muted-foreground italic mt-0.5 truncate">{batch.notes}</p>}
                      </div>
                      <div className="ml-3 flex-shrink-0">{statusBadge(batch.status)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Purchase Orders ---- */}
        <TabsContent value="orders" className="mt-4">
          <Card className="border-0 ring-1 ring-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-orange-600" />
                  Purchase Orders
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{orders.length} orders total</p>
              </div>
              <Button size="sm" onClick={() => setOrderDialog(true)} className="gap-1.5 bg-orange-600 hover:bg-orange-700">
                <Plus className="h-3.5 w-3.5" />New Order
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 rounded-xl border-2 border-dashed border-border text-center">
                  <div className="h-12 w-12 rounded-full bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center mb-3">
                    <ShoppingCart className="h-6 w-6 text-orange-400" />
                  </div>
                  <p className="font-medium text-sm mb-1">No purchase orders yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">Create an order to restock ingredients from a vendor.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {orders.map(order => (
                    <div key={order.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm">{order.vendor?.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? 's' : ''} · {order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy') : '—'}
                        </p>
                        <p className="text-xs font-medium text-orange-700 dark:text-orange-400 mt-0.5">
                          QAR {(order.items ?? []).reduce((s: number, i: any) => s + (Number(i.quantity) * Number(i.unitPrice || i.foodSupply?.pricePerUnit || 0)), 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="ml-3 flex-shrink-0">{statusBadge(order.status)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Stock Transfers ---- */}
        <TabsContent value="transfers" className="mt-4">
          <Card className="border-0 ring-1 ring-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-purple-600" />
                  Stock Transfers
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{transfers.length} transfers recorded</p>
              </div>
              <Button
                size="sm"
                onClick={() => setTransferDialog(true)}
                disabled={allKitchens.filter(k => k.id !== kitchenId).length === 0}
                className="gap-1.5 bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="h-3.5 w-3.5" />Transfer Stock
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {transfers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 rounded-xl border-2 border-dashed border-border text-center">
                  <div className="h-12 w-12 rounded-full bg-purple-50 dark:bg-purple-950/20 flex items-center justify-center mb-3">
                    <ArrowLeftRight className="h-6 w-6 text-purple-400" />
                  </div>
                  <p className="font-medium text-sm mb-1">No stock transfers yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    {allKitchens.filter(k => k.id !== kitchenId).length === 0
                      ? 'You need at least 2 kitchens to transfer stock between them.'
                      : 'Move inventory between kitchens to balance supply.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transfers.map(tr => (
                    <div key={tr.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm">
                          {tr.fromLocation?.name || 'Source'} → {tr.toLocation?.name || 'Destination'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tr.items?.length ?? 0} item{(tr.items?.length ?? 0) !== 1 ? 's' : ''} · {tr.createdAt ? format(new Date(tr.createdAt), 'dd MMM yyyy') : '—'}
                        </p>
                        {tr.notes && <p className="text-xs text-muted-foreground italic mt-0.5 truncate">{tr.notes}</p>}
                      </div>
                      <div className="ml-3 flex-shrink-0">{statusBadge(tr.status)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---- Production Batch Dialog ---- */}
      <Dialog open={batchDialog} onOpenChange={setBatchDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Plan Production Batch</DialogTitle>
            <DialogDescription>Schedule a recipe to be produced in this kitchen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Recipe</Label>
              <Select value={newBatch.recipeId} onValueChange={v => setNewBatch(p => ({ ...p, recipeId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select recipe…" /></SelectTrigger>
                <SelectContent>
                  {recipes.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity (servings)</Label>
                <Input type="number" min="1" value={newBatch.quantity} onChange={e => setNewBatch(p => ({ ...p, quantity: e.target.value }))} />
              </div>
              <div>
                <Label>Scheduled Date</Label>
                <Input type="date" value={newBatch.scheduledDate} onChange={e => setNewBatch(p => ({ ...p, scheduledDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={newBatch.notes} onChange={e => setNewBatch(p => ({ ...p, notes: e.target.value }))} placeholder="Any special instructions…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateBatch} disabled={isSavingBatch}>
              {isSavingBatch ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Plan Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Purchase Order Dialog ---- */}
      <Dialog open={orderDialog} onOpenChange={setOrderDialog}>
        <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
            <DialogDescription>Order ingredients from a vendor to restock this kitchen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Vendor</Label>
              <Select value={newOrder.vendorId} onValueChange={v => setNewOrder(p => ({ ...p, vendorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vendor…" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expected Delivery</Label>
              <Input type="date" value={newOrder.expectedDeliveryDate} onChange={e => setNewOrder(p => ({ ...p, expectedDeliveryDate: e.target.value }))} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items</Label>
                <Button variant="ghost" size="sm" onClick={() => setOrderItems(p => [...p, { foodSupplyId: '', quantity: '1', unitPrice: '' }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add item
                </Button>
              </div>
              {orderItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_80px_32px] gap-2 mb-2">
                  <Select value={item.foodSupplyId} onValueChange={v => setOrderItems(p => p.map((i, j) => j === idx ? { ...i, foodSupplyId: v } : i))}>
                    <SelectTrigger className="text-xs"><SelectValue placeholder="Ingredient…" /></SelectTrigger>
                    <SelectContent>
                      {foodSupplies.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name} ({f.unit})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => setOrderItems(p => p.map((i, j) => j === idx ? { ...i, quantity: e.target.value } : i))} />
                  <Input type="number" min="0" placeholder="Price" value={item.unitPrice} onChange={e => setOrderItems(p => p.map((i, j) => j === idx ? { ...i, unitPrice: e.target.value } : i))} />
                  <Button variant="ghost" size="sm" className="h-9 w-8 p-0 text-red-500" onClick={() => setOrderItems(p => p.filter((_, j) => j !== idx))} disabled={orderItems.length === 1}>×</Button>
                </div>
              ))}
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={newOrder.notes} onChange={e => setNewOrder(p => ({ ...p, notes: e.target.value }))} placeholder="Delivery instructions…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateOrder} disabled={isSavingOrder}>
              {isSavingOrder ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Stock Transfer Dialog ---- */}
      <Dialog open={transferDialog} onOpenChange={setTransferDialog}>
        <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transfer Stock</DialogTitle>
            <DialogDescription>Move inventory from {kitchenName || 'this kitchen'} to another kitchen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Destination Kitchen</Label>
              <Select value={newTransfer.toKitchenId} onValueChange={v => setNewTransfer(p => ({ ...p, toKitchenId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select destination…" /></SelectTrigger>
                <SelectContent>
                  {allKitchens.filter(k => k.id !== kitchenId).map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items to Transfer</Label>
                <Button variant="ghost" size="sm" onClick={() => setTransferItems(p => [...p, { foodSupplyId: '', quantity: '1' }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add item
                </Button>
              </div>
              {transferItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_32px] gap-2 mb-2">
                  <Select value={item.foodSupplyId} onValueChange={v => setTransferItems(p => p.map((i, j) => j === idx ? { ...i, foodSupplyId: v } : i))}>
                    <SelectTrigger className="text-xs"><SelectValue placeholder="Ingredient…" /></SelectTrigger>
                    <SelectContent>
                      {foodSupplies.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name} ({f.unit})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => setTransferItems(p => p.map((i, j) => j === idx ? { ...i, quantity: e.target.value } : i))} />
                  <Button variant="ghost" size="sm" className="h-9 w-8 p-0 text-red-500" onClick={() => setTransferItems(p => p.filter((_, j) => j !== idx))} disabled={transferItems.length === 1}>×</Button>
                </div>
              ))}
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={newTransfer.notes} onChange={e => setNewTransfer(p => ({ ...p, notes: e.target.value }))} placeholder="Reason for transfer…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTransfer} disabled={isSavingTransfer}>
              {isSavingTransfer ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Transfer Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
