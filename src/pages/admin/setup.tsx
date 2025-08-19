import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from 'next/router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AdminSetup() {
  const { user } = useAuth()
  const router = useRouter()
  const [storageStatus, setStorageStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [rlsStatus, setRlsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [storageMessage, setStorageMessage] = useState('')
  const [rlsMessage, setRlsMessage] = useState('')

  const setupStorage = async () => {
    try {
      setStorageStatus('loading')
      const response = await fetch('/api/admin/setup-storage', {
        method: 'POST',
      })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to setup storage')
      }
      
      setStorageStatus('success')
      setStorageMessage('Storage policies have been successfully configured!')
    } catch (error) {
      setStorageStatus('error')
      setStorageMessage(error instanceof Error ? error.message : 'An unexpected error occurred')
    }
  }

  const setupRLS = async () => {
    try {
      setRlsStatus('loading')
      const response = await fetch('/api/admin/enable-rls', {
        method: 'POST',
      })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to enable Row Level Security')
      }
      
      setRlsStatus('success')
      setRlsMessage('Row Level Security has been successfully enabled on the Ticket table!')
    } catch (error) {
      setRlsStatus('error')
      setRlsMessage(error instanceof Error ? error.message : 'An unexpected error occurred')
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto p-4">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>Please log in to access this page.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Admin Setup</h1>
      
      <Tabs defaultValue="storage" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="storage">Storage Setup</TabsTrigger>
          <TabsTrigger value="security">Security Setup</TabsTrigger>
        </TabsList>
        
        <TabsContent value="storage">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Storage Setup</h2>
            <p className="mb-4">
              This utility will set up the required storage policies for the application.
              This includes:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Allowing authenticated users to view files in the assets bucket</li>
              <li>Allowing authenticated users to upload files</li>
              <li>Allowing users to update their own files</li>
              <li>Allowing users to delete their own files</li>
              <li>Setting a file size limit of 5MB</li>
              <li>Restricting file types to JPEG and PNG</li>
            </ul>

            <Button 
              onClick={setupStorage}
              disabled={storageStatus === 'loading' || storageStatus === 'success'}
            >
              {storageStatus === 'loading' ? 'Setting up...' : 
               storageStatus === 'success' ? 'Setup Complete' : 
               'Setup Storage Policies'}
            </Button>

            {(storageStatus === 'success' || storageStatus === 'error') && (
              <Alert className="mt-4" variant={storageStatus === 'success' ? "default" : "destructive"}>
                <AlertDescription>
                  {storageMessage}
                </AlertDescription>
              </Alert>
            )}
          </Card>
        </TabsContent>
        
        <TabsContent value="security">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Row Level Security Setup</h2>
            <p className="mb-4">
              This utility will enable Row Level Security (RLS) on the Ticket table to enhance data security.
              This includes:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Enabling Row Level Security on the Ticket table</li>
              <li>Creating policies to ensure users can only access their own tickets</li>
              <li>Setting up separate policies for viewing, creating, updating, and deleting tickets</li>
              <li>Adding database-level protection against unauthorized access</li>
            </ul>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-md mb-4">
              <p className="text-amber-800 font-medium">⚠️ Warning</p>
              <p className="text-amber-700">
                This operation modifies database security settings and should only be run once.
                Running it multiple times may result in errors if policies already exist.
              </p>
            </div>

            <Button 
              onClick={setupRLS}
              disabled={rlsStatus === 'loading' || rlsStatus === 'success'}
              variant="outline"
              className="border-amber-500 text-amber-700 hover:bg-amber-50"
            >
              {rlsStatus === 'loading' ? 'Enabling RLS...' : 
               rlsStatus === 'success' ? 'RLS Enabled' : 
               'Enable Row Level Security'}
            </Button>

            {(rlsStatus === 'success' || rlsStatus === 'error') && (
              <Alert className="mt-4" variant={rlsStatus === 'success' ? "default" : "destructive"}>
                <AlertDescription>
                  {rlsMessage}
                </AlertDescription>
              </Alert>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}