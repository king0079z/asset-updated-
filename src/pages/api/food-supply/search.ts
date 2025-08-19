import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from '@/util/supabase/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { supabase, user } = await createClient(req, res);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { query, kitchenId } = req.query;
    
    // Get the organization ID from the user's session
    const { data: { organization_id } } = await supabase.auth.getSession();
    
    // If no query is provided, return a limited set of food supply items
    if (!query || query === '') {
      const recentFoodSupplyItems = await prisma.foodSupply.findMany({
        where: {
          organizationId: organization_id as string,
        },
        select: {
          id: true,
          name: true,
          unit: true,
          quantity: true,
          price: true,
          barcode: true,
          category: true,
          expirationDate: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 20, // Limit to recent 20 items
      });
      
      return res.status(200).json({ 
        items: recentFoodSupplyItems.map(item => ({
          ...item,
          similarityScore: 1,
          pricePerUnit: item.price,
        })),
        query: '' 
      });
    }

    // We already have the organization_id from above, no need to fetch it again

    // Perform fuzzy search on food supply items
    const foodSupplyItems = await prisma.foodSupply.findMany({
      where: {
        organizationId: organization_id as string,
        name: {
          contains: query as string,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        unit: true,
        quantity: true,
        price: true,
        barcode: true,
        category: true,
        expirationDate: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Calculate similarity scores for better matching
    const searchResults = foodSupplyItems.map(item => {
      const nameScore = calculateSimilarity(item.name.toLowerCase(), (query as string).toLowerCase());
      return {
        ...item,
        similarityScore: nameScore,
      };
    });

    // Sort by similarity score (highest first)
    searchResults.sort((a, b) => b.similarityScore - a.similarityScore);

    // Return the top matches
    return res.status(200).json({ 
      items: searchResults.slice(0, 10),
      query: query 
    });
  } catch (error) {
    console.error('Error searching food supply items:', error);
    return res.status(500).json({ error: 'Failed to search food supply items' });
  }
}

// Simple similarity calculation function
function calculateSimilarity(str1: string, str2: string): number {
  // Convert strings to lowercase for case-insensitive comparison
  str1 = str1.toLowerCase();
  str2 = str2.toLowerCase();
  
  // If exact match, return highest score
  if (str1 === str2) return 1;
  
  // If one string contains the other, high score
  if (str1.includes(str2)) return 0.9;
  if (str2.includes(str1)) return 0.8;
  
  // Check for word matches
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  
  let matchCount = 0;
  for (const word1 of words1) {
    if (word1.length < 3) continue; // Skip very short words
    for (const word2 of words2) {
      if (word2.length < 3) continue; // Skip very short words
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matchCount++;
        break;
      }
    }
  }
  
  // Calculate score based on word matches
  const maxWords = Math.max(words1.length, words2.length);
  if (maxWords === 0) return 0;
  
  return matchCount / maxWords;
}