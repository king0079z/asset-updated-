import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Download, FileSearch, AlertCircle, FileQuestion, Upload, Loader2, Trash2 } from 'lucide-react';
import { useTranslation } from "@/contexts/TranslationContext";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";

interface AssetDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

interface UserPermissions {
  canDeleteDocuments: boolean;
}

interface AssetDocumentsTabProps {
  assetId: string;
}

export function AssetDocumentsTab({ assetId }: AssetDocumentsTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<AssetDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<AssetDocument | null>(null);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({ canDeleteDocuments: false });
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  // Fetch user permissions
  const fetchUserPermissions = async () => {
    try {
      if (!user) {
        setUserPermissions({ canDeleteDocuments: false });
        setIsLoadingPermissions(false);
        return;
      }
      
      // Get current user data including permissions
      const response = await fetch('/api/users/permissions');
      
      if (!response.ok) {
        throw new Error(`Error fetching user permissions: ${response.statusText}`);
      }
      
      const userData = await response.json();
      
      if (userData) {
        setUserPermissions({ 
          canDeleteDocuments: userData.canDeleteDocuments || false 
        });
      } else {
        // Default to no permissions if user data not found
        setUserPermissions({ canDeleteDocuments: false });
      }
    } catch (error) {
      console.error("Failed to fetch user permissions:", error);
      // Default to no permissions if there's an error
      setUserPermissions({ canDeleteDocuments: false });
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/assets/${assetId}/documents`);
      
      if (!response.ok) {
        throw new Error(`Error fetching documents: ${response.statusText}`);
      }
      
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      setError("Failed to load documents. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Fetch user permissions first
    fetchUserPermissions();
  }, [user]);

  useEffect(() => {
    // Only fetch documents after permissions are loaded
    if (!isLoadingPermissions && assetId) {
      fetchDocuments();
    }
  }, [assetId, isLoadingPermissions]);

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return <FileText className="h-8 w-8 text-red-500" />;
    } else if (fileType.includes('word') || fileType.includes('doc')) {
      return <FileText className="h-8 w-8 text-blue-500" />;
    } else if (fileType.includes('image')) {
      return <FileText className="h-8 w-8 text-green-500" />;
    } else {
      return <FileQuestion className="h-8 w-8 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Return original if invalid
      
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };

  const handleViewDocument = (document: AssetDocument) => {
    setSelectedDocument(document);
    setShowDocumentDialog(true);
  };
  
  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const uploadDocument = async (file: File) => {
    if (!file) return;
    
    // Validate file type
    const allowedTypes = [
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 
      'image/png', 
      'image/jpg'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only PDF, Word documents, and images are allowed.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      // Create form data
      const formData = new FormData();
      formData.append('document', file);
      formData.append('assetId', assetId);
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + Math.random() * 10;
          return newProgress >= 90 ? 90 : newProgress;
        });
      }, 300);
      
      const response = await fetch('/api/assets/documents/upload', {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload document');
      }
      
      const data = await response.json();
      
      toast({
        title: "Document uploaded",
        description: "Document has been successfully uploaded.",
      });
      
      // Add the new document to the list
      setDocuments(prevDocuments => [data.document, ...prevDocuments]);
      
      // Reset upload state
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);
      
      // Refresh documents to get the latest data
      fetchDocuments();
      
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload document. Please try again.",
        variant: "destructive",
      });
      setIsUploading(false);
      setUploadProgress(0);
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadDocument(file);
    }
    // Reset the input value so the same file can be uploaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!documentId) return;
    
    try {
      setIsDeleting(true);
      
      const response = await fetch(`/api/assets/${assetId}/documents`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete document');
      }
      
      // Remove the document from the list
      setDocuments(prevDocuments => prevDocuments.filter(doc => doc.id !== documentId));
      
      // Close the dialog if the deleted document was being viewed
      if (selectedDocument?.id === documentId) {
        setShowDocumentDialog(false);
      }
      
      toast({
        title: "Document deleted",
        description: "Document has been successfully deleted.",
      });
      
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Show loading state while fetching permissions and documents
  if (isLoadingPermissions || isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Error Loading Documents</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchDocuments}>Try Again</Button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Documents Found</h3>
        <p className="text-muted-foreground mb-6">
          This asset doesn't have any uploaded documents yet.
        </p>
        <Button onClick={handleFileUpload} disabled={isUploading}>
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </>
          )}
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        />
        {isUploading && (
          <div className="w-full max-w-xs mt-4">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-center mt-1 text-muted-foreground">
              {Math.round(uploadProgress)}%
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Asset Documents</h3>
            <Button onClick={handleFileUpload} size="sm" disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
          </div>
          
          {isUploading && (
            <div className="w-full mb-4">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-right mt-1 text-muted-foreground">
                {Math.round(uploadProgress)}%
              </p>
            </div>
          )}
          
          <div className="space-y-4">
            {documents.map((document) => (
              <div key={document.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {getFileIcon(document.fileType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{document.fileName}</h4>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(document.fileSize)} • Uploaded on {formatDate(document.uploadedAt)}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8"
                        onClick={() => handleViewDocument(document)}
                      >
                        <FileSearch className="h-4 w-4 mr-1" /> View
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8"
                        asChild
                      >
                        <a href={document.fileUrl} download={document.fileName}>
                          <Download className="h-4 w-4 mr-1" /> Download
                        </a>
                      </Button>
                      {userPermissions.canDeleteDocuments && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8"
                          onClick={() => handleDeleteDocument(document.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4 mr-1 text-red-500" /> Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Document Viewer Dialog */}
      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.fileName}</DialogTitle>
            <DialogDescription>
              {formatFileSize(selectedDocument?.fileSize || 0)} • Uploaded on {selectedDocument ? formatDate(selectedDocument.uploadedAt) : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 h-[60vh] w-full overflow-hidden rounded-md border">
            {selectedDocument && (
              selectedDocument.fileType.includes('image') ? (
                <img 
                  src={selectedDocument.fileUrl} 
                  alt={selectedDocument.fileName}
                  className="h-full w-full object-contain"
                />
              ) : (
                <iframe 
                  src={selectedDocument.fileUrl} 
                  className="h-full w-full"
                  title={selectedDocument.fileName}
                />
              )
            )}
          </div>

          <div className="flex justify-between mt-4">
            {userPermissions.canDeleteDocuments && (
              <Button 
                variant="destructive" 
                onClick={() => selectedDocument && handleDeleteDocument(selectedDocument.id)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
            )}
            
            <div className={`flex gap-2 ${!userPermissions.canDeleteDocuments ? 'w-full justify-between' : ''}`}>
              <Button 
                variant="outline" 
                onClick={() => setShowDocumentDialog(false)}
              >
                Close
              </Button>
              <Button 
                variant="default" 
                asChild
              >
                <a href={selectedDocument?.fileUrl} download={selectedDocument?.fileName}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}