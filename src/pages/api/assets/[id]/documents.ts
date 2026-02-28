import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/util/supabase/api";
import prisma from '@/lib/prisma';
import { createAuditLog } from "@/lib/audit";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Get the authenticated user
  const supabase = createClient(req, res);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Authentication error:", authError);
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: "Asset ID is required" });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, isAdmin: true, organizationId: true },
  });
  if (!currentUser) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const isPrivilegedUser =
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'MANAGER' ||
    currentUser.isAdmin === true;
  const assetScope = isPrivilegedUser && currentUser.organizationId
    ? { organizationId: currentUser.organizationId }
    : { userId: user.id };

  // Verify the asset exists and is in user's scope
  const asset = await prisma.asset.findFirst({
    where: { id, ...assetScope },
  });

  if (!asset) {
    return res.status(404).json({ message: "Asset not found or access denied" });
  }

  // Handle GET request - Fetch all documents for the asset
  if (req.method === "GET") {
    try {
      const documents = await prisma.assetDocument.findMany({
        where: { assetId: id },
        orderBy: { uploadedAt: 'desc' },
      });

      return res.status(200).json({ documents });
    } catch (error) {
      console.error("Error fetching asset documents:", error);
      return res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Handle DELETE request - Delete a document
  if (req.method === "DELETE") {
    try {
      const { documentId } = req.body;
      
      if (!documentId) {
        return res.status(400).json({ message: "Document ID is required" });
      }

      if (!isPrivilegedUser && asset.userId !== user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Verify the document exists and belongs to the asset
      const document = await prisma.assetDocument.findFirst({
        where: { 
          id: documentId,
          assetId: id
        },
      });
      
      if (!document) {
        return res.status(404).json({ message: "Document not found or does not belong to this asset" });
      }
      
      // Delete the document
      await prisma.assetDocument.delete({
        where: { id: documentId },
      });
      
      // Log the document deletion
      await createAuditLog({
        action: "DOCUMENT_DELETED",
        resourceType: "ASSET_DOCUMENT",
        resourceId: documentId,
        details: {
          userId: user.id,
          userEmail: user.email,
          assetId: id,
          fileName: document.fileName
        }
      });
      
      return res.status(200).json({ 
        message: "Document deleted successfully",
        documentId
      });
    } catch (error) {
      console.error("Error deleting document:", error);
      return res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // If the method is not supported
  return res.status(405).json({ message: "Method not allowed" });
}