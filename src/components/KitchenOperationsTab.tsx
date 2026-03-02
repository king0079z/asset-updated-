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

const statusColors: Record<string, string> = {
  PLANNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  PENDING: 'bg-orange-100 text-orange-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Kitchen Operations</h2>
          <p className="text-sm text-muted-foreground">Manage production, ordering, and stock movements for {kitchenName || 'this kitchen'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Planned Batches', value: batches.filter(b => b.status === 'PLANNED').length, icon: ClipboardList, color: 'text-blue-600' },
          { label: 'Pending Orders', value: orders.filter(o => o.status === 'PENDING').length, icon: ShoppingCart, color: 'text-orange-600' },
          { label: 'Pending Transfers', value: transfers.filter(t => t.status === 'PENDING').length, icon: ArrowLeftRight, color: 'text-purple-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-6 w-6 ${color}`} />
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeOp} onValueChange={(v: any) => setActiveOp(v)}>
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="batches"><ClipboardList className="h-4 w-4 mr-1.5" />Production</TabsTrigger>
          <TabsTrigger value="orders"><ShoppingCart className="h-4 w-4 mr-1.5" />Purchase Orders</TabsTrigger>
          <TabsTrigger value="transfers"><ArrowLeftRight className="h-4 w-4 mr-1.5" />Stock Transfers</TabsTrigger>
        </TabsList>

        {/* ---- Production Batches ---- */}
        <TabsContent value="batches">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Production Batches</CardTitle>
              <Button size="sm" onClick={() => setBatchDialog(true)}>
                <Plus className="h-4 w-4 mr-1.5" />Plan Batch
              </Button>
            </CardHeader>
            <CardContent>
              {batches.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No production batches yet.</p>
                  <p className="text-xs mt-1">Plan a batch to schedule recipe production in advance.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {batches.map(batch => (
                    <div key={batch.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{batch.recipe?.name || 'Unknown Recipe'}</p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {batch.quantity} servings · {batch.scheduledDate ? format(new Date(batch.scheduledDate), 'dd MMM yyyy') : '—'}
                        </p>
                        {batch.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{batch.notes}</p>}
                      </div>
                      <Badge className={statusColors[batch.status] || 'bg-gray-100 text-gray-700'}>{batch.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Purchase Orders ---- */}
        <TabsContent value="orders">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Purchase Orders</CardTitle>
              <Button size="sm" onClick={() => setOrderDialog(true)}>
                <Plus className="h-4 w-4 mr-1.5" />New Order
              </Button>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No purchase orders yet.</p>
                  <p className="text-xs mt-1">Create an order to restock ingredients from a vendor.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {orders.map(order => (
                    <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{order.vendor?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.items?.length} item{order.items?.length !== 1 ? 's' : ''} · {order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy') : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Total: QAR {order.items?.reduce((s: number, i: any) => s + (i.quantity * (i.unitPrice || i.foodSupply?.pricePerUnit || 0)), 0).toFixed(2)}
                        </p>
                      </div>
                      <Badge className={statusColors[order.status] || 'bg-gray-100 text-gray-700'}>{order.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Stock Transfers ---- */}
        <TabsContent value="transfers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Stock Transfers</CardTitle>
              <Button size="sm" onClick={() => setTransferDialog(true)} disabled={allKitchens.filter(k => k.id !== kitchenId).length === 0}>
                <Plus className="h-4 w-4 mr-1.5" />Transfer Stock
              </Button>
            </CardHeader>
            <CardContent>
              {transfers.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No stock transfers yet.</p>
                  <p className="text-xs mt-1">Move inventory between kitchens to balance supply.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transfers.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {t.fromLocation?.name} → {t.toLocation?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.items?.length} item{t.items?.length !== 1 ? 's' : ''} · {t.requestedAt ? format(new Date(t.requestedAt), 'dd MMM yyyy') : '—'}
                        </p>
                      </div>
                      <Badge className={statusColors[t.status] || 'bg-gray-100 text-gray-700'}>{t.status}</Badge>
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
