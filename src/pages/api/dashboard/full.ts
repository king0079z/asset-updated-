// @ts-nocheck
/**
 * Batched dashboard API: ONE round-trip, NO internal HTTP.
 * Computes stats + rental costs + total consumed + total value + total spent
 * with direct Prisma/raw SQL in this handler. Avoids 5 cold serverless calls.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/util/supabase/require-auth';
import prisma from '@/lib/prisma';

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const fullCache = new Map<string, { data: any; timestamp: number }>();

const safeNum = (v: any, d = 0) => (typeof v === 'number' ? v : (Number(v) || d));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { user } = auth;

    const cached = fullCache.get(user.id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      res.setHeader('Cache-Control', 'private, max-age=120, stale-while-revalidate=60');
      return res.status(200).json(cached.data);
    }

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Single batch of parallel DB work (no internal fetch)
    const [
      totalAssets,
      totalFoodItems,
      activeVehicleRentals,
      lowStockItems,
      vehicleStatsGroup,
      assetStatsGroup,
      totalAssetCosts,
      disposedAssetCosts,
      foodConsumptionMonth,
      vehicleRentalsRecent,
      totalConsumedRow,
      totalValueRow,
      vehicleSum,
      maintenanceMonth,
      maintenanceYear,
      foodConsumptionYearAgg,
      assetsPurchasedYearAgg,
      vehicleRentalsYear,
      vehicleMaintenancesYear,
      assetsPurchasedYearList,
    ] = await Promise.all([
      prisma.asset.count({ where: { status: { not: 'DISPOSED' } } }),
      prisma.foodSupply.count(),
      prisma.vehicleRental.count({
        where: { status: 'RENTED', endDate: { gte: today } },
      }),
      prisma.foodSupply.count({ where: { quantity: { lte: 10 } } }),
      prisma.vehicle.groupBy({ by: ['status'], _count: true }),
      prisma.asset.groupBy({ by: ['status'], _count: true }),
      prisma.asset.aggregate({
        _sum: { purchaseAmount: true },
        where: { status: { not: 'DISPOSED' }, purchaseAmount: { not: null } },
      }),
      prisma.asset.aggregate({
        _sum: { purchaseAmount: true },
        where: { status: 'DISPOSED', purchaseAmount: { not: null } },
      }),
      prisma.foodConsumption.findMany({
        where: { date: { gte: startOfMonth } },
        select: { date: true, quantity: true, foodSupply: { select: { pricePerUnit: true } } },
        take: 200,
      }),
      prisma.vehicleRental.findMany({
        where: {
          OR: [
            { startDate: { gte: startOfYear } },
            { status: 'RENTED', endDate: { gte: today } },
          ],
        },
        include: { vehicle: { select: { make: true, model: true, status: true, rentalAmount: true } } },
        orderBy: { startDate: 'desc' },
        take: 20,
      }),
      prisma.$queryRaw<[{ total: number }]>`
        SELECT COALESCE(SUM(fc.quantity * fs."pricePerUnit"), 0) AS total
        FROM "FoodConsumption" fc
        JOIN "FoodSupply" fs ON fc."foodSupplyId" = fs.id
      `.then((r) => r[0]?.total ?? 0),
      prisma.$queryRaw<[{ total: number }]>`
        SELECT COALESCE(SUM(quantity * "pricePerUnit"), 0) AS total FROM "FoodSupply"
      `.then((r) => r[0]?.total ?? 0),
      prisma.vehicle.aggregate({ _sum: { rentalAmount: true } }),
      prisma.vehicleMaintenance.aggregate({
        _sum: { cost: true },
        where: { maintenanceDate: { gte: startOfMonth, lte: today } },
      }),
      prisma.vehicleMaintenance.aggregate({
        _sum: { cost: true },
        where: { maintenanceDate: { gte: startOfYear, lte: today } },
      }),
      prisma.$queryRaw<[{ total: number }]>`
        SELECT COALESCE(SUM(fc.quantity * fs."pricePerUnit"), 0) AS total
        FROM "FoodConsumption" fc
        JOIN "FoodSupply" fs ON fc."foodSupplyId" = fs.id
        WHERE fc.date >= ${startOfYear} AND fc.date <= ${today}
      `.then((r) => r[0]?.total ?? 0),
      prisma.asset.aggregate({
        _sum: { purchaseAmount: true },
        where: {
          createdAt: { gte: startOfYear, lte: today },
          purchaseAmount: { not: null },
        },
      }),
      prisma.vehicleRental.findMany({
        where: { startDate: { gte: startOfYear, lte: today } },
        include: { vehicle: { select: { rentalAmount: true } } },
        take: 500,
      }),
      prisma.vehicleMaintenance.findMany({
        where: { maintenanceDate: { gte: startOfYear, lte: today } },
        select: { cost: true, maintenanceDate: true },
        take: 500,
      }),
      prisma.asset.findMany({
        where: { createdAt: { gte: startOfYear, lte: today }, purchaseAmount: { not: null } },
        select: { purchaseAmount: true, createdAt: true },
        take: 500,
      }),
    ]);

    const monthlyRentalTotal = safeNum(vehicleSum._sum?.rentalAmount, 0);
    const yearlyRentalTotal = monthlyRentalTotal * 12;
    const monthlyMaintenanceTotal = safeNum(maintenanceMonth._sum?.cost, 0);
    const yearlyMaintenanceTotal = safeNum(maintenanceYear._sum?.cost, 0);

    const totalFoodCost = foodConsumptionMonth.reduce((sum, item) => {
      return sum + (item.quantity || 0) * safeNum(item.foodSupply?.pricePerUnit, 0);
    }, 0);

    const totalVehicleCost = vehicleRentalsRecent.reduce((sum, rental) => {
      const amount = safeNum(rental.vehicle?.rentalAmount, 0);
      const start = new Date(rental.startDate);
      const end = rental.endDate ? new Date(rental.endDate) : today;
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      return sum + (amount / 30) * days;
    }, 0);

    const rentalTrendsByDay: Record<string, number> = {};
    vehicleRentalsRecent.forEach((r) => {
      if (r.startDate) {
        const d = new Date(r.startDate).toISOString().split('T')[0];
        rentalTrendsByDay[d] = (rentalTrendsByDay[d] || 0) + 1;
      }
    });
    const monthlyFoodCostsArray = Object.entries(
      foodConsumptionMonth.reduce((acc, item) => {
        const date = item.date.toISOString().split('T')[0];
        const cost = (item.quantity || 0) * safeNum(item.foodSupply?.pricePerUnit, 0);
        acc[date] = (acc[date] || 0) + cost;
        return acc;
      }, {} as Record<string, number>)
    ).map(([date, cost]) => ({ date, cost: String(Number(cost).toFixed(2)) }));

    const totalVehicleRentalCosts = vehicleRentalsYear.reduce((sum, rental) => {
      const amount = safeNum(rental.vehicle?.rentalAmount, 0);
      let start = new Date(rental.startDate);
      let end = rental.endDate ? new Date(rental.endDate) : today;
      if (start < startOfYear) start = startOfYear;
      if (end > today) end = today;
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      return sum + (amount / 30) * days;
    }, 0);
    const totalVehicleMaintenanceCosts = vehicleMaintenancesYear.reduce((s, m) => s + safeNum(m.cost, 0), 0);
    const totalAmountSpent =
      Number(foodConsumptionYearAgg) +
      safeNum(assetsPurchasedYearAgg._sum?.purchaseAmount, 0) +
      totalVehicleRentalCosts +
      totalVehicleMaintenanceCosts;

    const currentMonth = today.getMonth() + 1;
    const monthlyData = Array.from({ length: currentMonth }, (_, i) => {
      const monthStart = new Date(today.getFullYear(), i, 1);
      const monthEnd = new Date(today.getFullYear(), i + 1, 0, 23, 59, 59);
      const monthName = monthStart.toLocaleString('default', { month: 'long' });
      const monthFood = foodConsumptionMonth
        .filter((item) => {
          const d = new Date(item.date);
          return d >= monthStart && d <= monthEnd;
        })
        .reduce((s, item) => s + (item.quantity || 0) * safeNum(item.foodSupply?.pricePerUnit, 0), 0);
      const monthAssets = (assetsPurchasedYearList || [])
        .filter((a) => {
          const d = new Date(a.createdAt);
          return d >= monthStart && d <= monthEnd;
        })
        .reduce((s, a) => s + safeNum(a.purchaseAmount, 0), 0);
      const monthRental = vehicleRentalsYear.reduce((s, rental) => {
        const amount = safeNum(rental.vehicle?.rentalAmount, 0);
        let start = new Date(rental.startDate);
        let end = rental.endDate ? new Date(rental.endDate) : today;
        if (start <= monthEnd && end >= monthStart) {
          const rs = start < monthStart ? monthStart : start;
          const re = end > monthEnd ? monthEnd : end;
          const days = Math.max(1, Math.ceil((re.getTime() - rs.getTime()) / (1000 * 60 * 60 * 24)));
          return s + (amount / 30) * days;
        }
        return s;
      }, 0);
      const monthMaint = vehicleMaintenancesYear
        .filter((m) => {
          const d = new Date(m.maintenanceDate);
          return d >= monthStart && d <= monthEnd;
        })
        .reduce((s, m) => s + safeNum(m.cost, 0), 0);
      const total = monthFood + monthAssets + monthRental + monthMaint;
      return {
        month: monthName,
        year: today.getFullYear(),
        foodConsumption: Number(monthFood.toFixed(2)),
        assetsPurchased: Number(monthAssets.toFixed(2)),
        vehicleRentalCosts: Number(monthRental.toFixed(2)),
        vehicleMaintenanceCosts: Number(monthMaint.toFixed(2)),
        vehicleTotal: Number((monthRental + monthMaint).toFixed(2)),
        total: Number(total.toFixed(2)),
      };
    });

    const payload = {
      totalAssets: Number(totalAssets),
      totalFoodItems: Number(totalFoodItems),
      activeVehicleRentals: Number(activeVehicleRentals),
      lowStockItems: Number(lowStockItems),
      totalFoodCost: Number(totalFoodCost.toFixed(2)),
      totalVehicleCost: Number(totalVehicleCost.toFixed(2)),
      totalFoodConsumption: Number(totalConsumedRow),
      totalFoodSupplyValue: Number(Number(totalValueRow).toFixed(2)),
      monthlyFoodCosts: monthlyFoodCostsArray,
      recentRentals: vehicleRentalsRecent.slice(0, 5).map((rental) => ({
        id: rental.id,
        startDate: rental.startDate,
        endDate: rental.endDate ?? today,
        vehicle: {
          make: rental.vehicle?.make ?? '',
          model: rental.vehicle?.model ?? '',
          status: rental.vehicle?.status ?? '',
          rentalAmount: safeNum(rental.vehicle?.rentalAmount, 0),
        },
      })),
      vehicleStats: (vehicleStatsGroup || []).map((s) => ({ status: s.status, _count: s._count })),
      rentalTrends: Object.entries(rentalTrendsByDay).map(([startDate, _count]) => ({ startDate, _count })),
      assetStats: {
        byStatus: (assetStatsGroup || []).map((s) => ({ status: s.status, count: s._count })),
        totalValue: safeNum(totalAssetCosts._sum?.purchaseAmount, 0),
        disposedValue: safeNum(disposedAssetCosts._sum?.purchaseAmount, 0),
      },
      rentalCosts: {
        monthlyTotal: monthlyRentalTotal + monthlyMaintenanceTotal,
        yearlyTotal: yearlyRentalTotal + yearlyMaintenanceTotal,
        monthlyRentalTotal,
        yearlyRentalTotal,
        monthlyMaintenanceTotal,
        yearlyMaintenanceTotal,
      },
      totalAmountSpent: Number(totalAmountSpent.toFixed(2)),
      amountSpentBreakdown: {
        foodConsumption: Number(Number(foodConsumptionYearAgg).toFixed(2)),
        assetsPurchased: Number(safeNum(assetsPurchasedYearAgg._sum?.purchaseAmount, 0).toFixed(2)),
        vehicleRentalCosts: Number(totalVehicleRentalCosts.toFixed(2)),
        vehicleMaintenanceCosts: Number(totalVehicleMaintenanceCosts.toFixed(2)),
        vehicleTotal: Number((totalVehicleRentalCosts + totalVehicleMaintenanceCosts).toFixed(2)),
      },
      monthlyData,
    };

    fullCache.set(user.id, { data: payload, timestamp: Date.now() });
    res.setHeader('Cache-Control', 'private, max-age=120, stale-while-revalidate=60');
    return res.status(200).json(payload);
  } catch (e) {
    console.error('[dashboard/full]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
