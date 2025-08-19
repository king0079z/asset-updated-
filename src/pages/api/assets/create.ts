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
  // Generate a CODE128 compatible barcode
  // Remove any special characters and ensure it's alphanumeric
  const cleanAssetId = assetId.replace(/[^A-Z0-9]/g, '');
  
  // Ensure minimum length for better scanning reliability
  if (cleanAssetId.length < 8) {
    const padding = '0'.repeat(8 - cleanAssetId.length);
    return cleanAssetId + padding;
  }
  
  return cleanAssetId;
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Authentication error:", authError);
      return res.status(401).json({ message: "Unauthorized", details: authError });
    }

    console.log("Processing asset creation for user:", user.id);

    const {
      name,
      description,
      type,
      vendorId,
      floorNumber,
      roomNumber,
      imageUrl,
      latitude,
      longitude,
      locationAccuracy,
      locationSource,
      purchaseAmount,
      purchaseDate,
    } = req.body;

    console.log("Received asset data:", {
      name,
      type,
      vendorId,
      hasImage: !!imageUrl,
      hasLocation: !!(latitude && longitude),
      purchaseAmount,
      purchaseDate
    });

    // Validate required fields
    if (!name || !type || !vendorId) {
      return res.status(400).json({
        message: "Missing required fields",
        required: ["name", "type", "vendorId"],
        received: { name, type, vendorId }
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

    const assetId = generateAssetId(type);
    const barcode = generateBarcode(assetId);

    console.log("Generated IDs:", { assetId, barcode });

    // Validate location data if provided
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          message: "Invalid location coordinates",
          details: { latitude, longitude }
        });
      }
    }

    // Log purchase date information before creating the asset
    if (purchaseDate) {
      console.log(`Purchase date before processing: ${purchaseDate}`);
      console.log(`Purchase date type: ${typeof purchaseDate}`);
      const parsedDate = new Date(purchaseDate);
      console.log(`Parsed purchase date: ${parsedDate.toISOString()}`);
      console.log(`Is valid date: ${!isNaN(parsedDate.getTime())}`);
    } else {
      console.log('No purchase date provided');
    }

    const asset = await prisma.$transaction(async (prisma) => {
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

      // Create the asset
      const newAsset = await prisma.asset.create({
        data: {
          assetId,
          name,
          description: description || "",
          barcode,
          type,
          imageUrl: imageUrl || null,
          floorNumber: floorNumber || null,
          roomNumber: roomNumber || null,
          status: "ACTIVE",
          userId: user.id,
          vendorId,
          purchaseAmount: purchaseAmount ? parseFloat(purchaseAmount) : null,
          purchaseDate: parsedPurchaseDate,
          location: latitude && longitude ? {
            create: {
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude),
              accuracy: locationAccuracy ? parseFloat(locationAccuracy) : null,
              source: locationSource || null,
            },
          } : undefined,
        },
        include: {
          vendor: {
            select: {
              name: true,
            },
          },
          location: true,
        },
      });
      
      // Log the created asset's purchase date
      console.log(`Created asset purchase date: ${newAsset.purchaseDate ? new Date(newAsset.purchaseDate).toISOString() : 'null'}`);
      

      // Create history record for asset creation
      await prisma.assetHistory.create({
        data: {
          assetId: newAsset.id,
          userId: user.id,
          action: "REGISTERED",
          details: {
            floorNumber: floorNumber || null,
            roomNumber: roomNumber || null,
            type: type,
            vendorId: vendorId,
            purchaseAmount: purchaseAmount ? parseFloat(purchaseAmount) : null,
          },
        },
      });

      return newAsset;
    });

    console.log("Asset created successfully:", {
      id: asset.id,
      assetId: asset.assetId,
      name: asset.name
    });

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
        purchaseAmount: purchaseAmount ? parseFloat(purchaseAmount) : null,
        purchaseDate: purchaseDate || null,
        hasLocation: !!(latitude && longitude)
      },
      {
        action: 'Asset Registration',
        assetName: name,
        assetType: type,
        location: floorNumber && roomNumber ? `Floor ${floorNumber}, Room ${roomNumber}` : 'Not specified',
        userId: user.id,
        userEmail: user.email
      }
    );
    
    // Also log as user activity for the user activity tab
    await logUserActivity(
      'ASSET_CREATED',
      'ASSET',
      {
        assetId: asset.assetId,
        assetName: name,
        assetType: type,
        vendorName: vendor.name,
        location: floorNumber && roomNumber ? `Floor ${floorNumber}, Room ${roomNumber}` : 'Not specified',
        purchaseAmount: purchaseAmount ? parseFloat(purchaseAmount) : null,
        purchaseDate: purchaseDate || null,
        hasLocation: !!(latitude && longitude),
        timestamp: new Date().toISOString(),
        userId: user.id,
        userEmail: user.email
      },
      asset.id
    );

    return res.status(201).json(asset);
  } catch (error) {
    console.error("Error creating asset:", error);
    return res.status(500).json({ 
      message: "Failed to create asset",
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? {
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } : undefined
    });
  }
}