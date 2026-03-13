// @ts-nocheck
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { createClient } from "@/util/supabase/api";
import { logDataModification, logUserActivity } from "@/lib/audit";

function generateAssetId(type: string) {
  const prefix = type.substring(0, 2).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
}

function generateBarcode(assetId: string) {
  return assetId; // Return the assetId directly to ensure they match
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Get the authenticated user
    const supabase = createClient(req, res);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (authError || !user) {
      console.error("Authentication error:", authError);
      return res.status(401).json({ message: "Unauthorized", details: authError });
    }

    console.log("Processing asset duplication for user:", user.id);

    const {
      count,
      name,
      description,
      type,
      vendorId,
      floorNumber,
      roomNumber,
      purchaseAmount,
      purchaseDate,
      imageUrl, // Add imageUrl to the destructured request body
    } = req.body;

    console.log("Received asset duplication data:", {
      count,
      name,
      type,
      vendorId,
      floorNumber,
      roomNumber,
      purchaseAmount,
      purchaseDate
    });

    // Validate required fields
    if (!count || !name || !type || !vendorId || !floorNumber || !roomNumber) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["count", "name", "type", "vendorId", "floorNumber", "roomNumber"],
        received: { count, name, type, vendorId, floorNumber, roomNumber }
      });
    }

    // Validate count is a positive integer
    const duplicateCount = parseInt(count.toString());
    if (isNaN(duplicateCount) || duplicateCount <= 0) {
      return res.status(400).json({
        message: "Count must be a positive integer",
        received: count
      });
    }

    // Validate vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId }
    });

    if (!vendor) {
      console.error("Vendor not found:", vendorId);
      return res.status(400).json({
        message: "Invalid vendor ID",
        details: { providedVendorId: vendorId }
      });
    }

    // Properly handle purchase date
    let parsedPurchaseDate = null;
    if (purchaseDate) {
      try {
        parsedPurchaseDate = new Date(purchaseDate);
        // Validate the date is valid
        if (isNaN(parsedPurchaseDate.getTime())) {
          console.error(`Invalid purchase date format: ${purchaseDate}`);
          parsedPurchaseDate = null;
        } else {
          console.log(`Parsed purchase date: ${parsedPurchaseDate.toISOString()}`);
        }
      } catch (dateError) {
        console.error(`Error parsing purchase date: ${dateError}`);
        parsedPurchaseDate = null;
      }
    }

    // Create the specified number of assets
    const createdAssets = [];
    
    for (let i = 0; i < duplicateCount; i++) {
      const assetId = generateAssetId(type);
      const barcode = generateBarcode(assetId);
      
      console.log(`Creating duplicate asset ${i+1}/${duplicateCount} with ID: ${assetId}`);
      
      const asset = await prisma.$transaction(async (prisma) => {
        // Create the asset
        const newAsset = await prisma.asset.create({
          data: {
            assetId,
            name,
            description: description || "",
            barcode,
            type,
            floorNumber,
            roomNumber,
            status: "ACTIVE",
            userId: user.id,
            vendorId,
            purchaseAmount: purchaseAmount ? parseFloat(purchaseAmount.toString()) : null,
            purchaseDate: parsedPurchaseDate,
            imageUrl: imageUrl || null, // Include the imageUrl in the created asset
          },
          include: {
            vendor: {
              select: {
                name: true,
              },
            },
          },
        });

        // Create history record for asset creation
        await prisma.assetHistory.create({
          data: {
            assetId: newAsset.id,
            userId: user.id,
            action: "REGISTERED",
            details: {
              floorNumber,
              roomNumber,
              type,
              vendorId,
              purchaseAmount: purchaseAmount ? parseFloat(purchaseAmount.toString()) : null,
              duplicated: true,
            },
          },
        });

        return newAsset;
      });

      createdAssets.push(asset);

      // Create audit log for asset creation
      await logDataModification(
        'ASSET',
        asset.id,
        'CREATE',
        {
          assetId: asset.assetId,
          name,
          type,
          vendorId,
          vendorName: vendor.name,
          floorNumber,
          roomNumber,
          purchaseAmount: purchaseAmount ? parseFloat(purchaseAmount.toString()) : null,
          purchaseDate: purchaseDate || null,
          duplicated: true,
        },
        {
          action: 'Asset Duplication',
          assetName: name,
          assetType: type,
          location: `Floor ${floorNumber}, Room ${roomNumber}`,
          userId: user.id,
          userEmail: user.email
        }
      );
      
      // Also log as user activity for the user activity tab
      await logUserActivity(
        'ASSET_DUPLICATED',
        'ASSET',
        {
          assetId: asset.assetId,
          assetName: name,
          assetType: type,
          vendorName: vendor.name,
          location: `Floor ${floorNumber}, Room ${roomNumber}`,
          purchaseAmount: purchaseAmount ? parseFloat(purchaseAmount.toString()) : null,
          purchaseDate: purchaseDate || null,
          timestamp: new Date().toISOString(),
          userId: user.id,
          userEmail: user.email
        },
        asset.id
      );
      
      // If this is the first duplicated asset, check for documents from the original asset
      if (i === 0 && req.body.originalAssetId) {
        try {
          const originalAssetId = req.body.originalAssetId;
          
          // Find documents from the original asset
          const originalDocuments = await prisma.assetDocument.findMany({
            where: { assetId: originalAssetId }
          });
          
          if (originalDocuments.length > 0) {
            console.info(`Copying ${originalDocuments.length} documents from original asset to duplicated assets`);
            
            // Copy documents to all duplicated assets
            for (const doc of originalDocuments) {
              await prisma.assetDocument.create({
                data: {
                  assetId: asset.id,
                  fileName: doc.fileName,
                  fileUrl: doc.fileUrl,
                  fileType: doc.fileType,
                  fileSize: doc.fileSize,
                  uploadedById: user.id,
                  ocrProcessed: doc.ocrProcessed,
                  ocrData: doc.ocrData,
                  ocrSummary: doc.ocrSummary
                }
              });
            }
          }
        } catch (docError) {
          console.error("Error copying documents to duplicated asset:", docError);
          // Don't fail the duplication if document copying fails
        }
      }
    }

    console.log(`Successfully created ${createdAssets.length} duplicate assets`);
    return res.status(201).json(createdAssets);
  } catch (error) {
    console.error("Error duplicating assets:", error);
    return res.status(500).json({ 
      message: "Failed to duplicate assets",
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? {
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } : undefined
    });
  }
}