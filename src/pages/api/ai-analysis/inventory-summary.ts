// @ts-nocheck
/**
 * POST /api/ai-analysis/inventory-summary
 * Rule-based "AI" suggestions for handheld inventory reconciliation.
 * Suggests variance reason and a short summary for the session (no external AI required).
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getSessionSafe } from '@/util/supabase/require-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user } = await getSessionSafe(req, res);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || {};
    const sessionLocationDisplay = body.sessionLocationDisplay;
    const missingCount = Number(body.missingCount) || 0;
    const extraCount = Number(body.extraCount) || 0;
    const extraFromOtherLocations = Boolean(body.extraFromOtherLocations);
    const extraLocationList = Array.isArray(body.extraLocationList) ? body.extraLocationList : [];
    const missingRecentMovedCount = Number(body.missingRecentMovedCount) || 0;
    const totalScanned = Number(body.totalScanned) || 0;
    const inSystemAtLocation = Number(body.inSystemAtLocation) || 0;

    let suggestedReason = '';
    const tips: string[] = [];

    // Suggest variance reason from pattern
    if (extraCount > 0 && missingCount === 0 && extraFromOtherLocations) {
      suggestedReason = 'WRONG_LOCATION';
      tips.push(
        extraLocationList.length === 1
          ? `All ${extraCount} item(s) were scanned at a different location (${extraLocationList[0]}). Move them to ${sessionLocationDisplay || 'this room'} or start a new count there.`
          : `Items from other locations: ${extraLocationList.slice(0, 3).join(', ')}. Use "Move to current room" or change count location.`
      );
    } else if (missingCount > 0 && extraCount === 0) {
      if (missingRecentMovedCount >= missingCount * 0.5) {
        suggestedReason = 'NOT_FOUND';
        tips.push(`${missingRecentMovedCount} of ${missingCount} missing item(s) were recently moved — they may have been relocated.`);
      } else {
        suggestedReason = 'MISSING';
        tips.push(`${missingCount} item(s) in system at this location were not scanned. Verify they are not in the room or were moved.`);
      }
    } else if (missingCount > 0 && extraCount > 0) {
      suggestedReason = 'OTHER';
      tips.push(`Variance: ${missingCount} missing, ${extraCount} from other/wrong location. Fix locations or add a note for the reviewer.`);
    } else if (extraCount > 0 && !extraFromOtherLocations) {
      suggestedReason = 'OTHER';
      tips.push(`${extraCount} scanned item(s) not in system. They may be unregistered assets — add a note for the reviewer.`);
    }

    const summaryLine =
      tips[0] ||
      (inSystemAtLocation === totalScanned && totalScanned > 0
        ? 'Count matches system for this location.'
        : 'Review variances and add a reason or note before submitting.');

    return res.status(200).json({
      suggestedReason,
      summaryLine,
      tips,
    });
  } catch (error) {
    console.error('Inventory summary error:', error);
    return res.status(500).json({
      error: 'Failed to generate summary',
      suggestedReason: '',
      summaryLine: 'Add a reason or note for the reviewer.',
      tips: [],
    });
  }