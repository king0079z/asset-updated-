import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, Battery, Calendar, Check, Cpu, HardDrive, Info, PlugZap, RefreshCw, Trash2, Truck, Wifi } from "lucide-react";
import { format } from "date-fns";

interface TrackingDevice {
  id: string;
  deviceId: string;
  name: string;
  type: string;
  status: string;
  vehicleId: string | null;
  lastPing: string | null;
  batteryLevel: number | null;
  firmwareVersion: string | null;
  installDate: string | null;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
  vehicle?: {
    id: string;
    name: string;
    plateNumber: string;
  };
}

interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
}

export default function TrackingDeviceManager() {
  const [devices, setDevices] = useState<TrackingDevice[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<TrackingDevice | null>(null);
  const [newDevice, setNewDevice] = useState({
    name: "",
    deviceId: "",
    type: "GPS_TRACKER",
  });
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    fetchDevices();
    fetchVehicles();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/vehicles/tracking-devices");
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch tracking devices",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching tracking devices:", error);
      toast({
        title: "Error",
        description: "Failed to fetch tracking devices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const response = await fetch("/api/vehicles");
      if (response.ok) {
        const data = await response.json();
        setVehicles(data.vehicles);
      }
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  };

  const handleAddDevice = async () => {
    try {
      const response = await fetch("/api/vehicles/tracking-devices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newDevice),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Tracking device added successfully",
        });
        setIsAddDialogOpen(false);
        setNewDevice({
          name: "",
          deviceId: "",
          type: "GPS_TRACKER",
        });
        fetchDevices();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to add tracking device",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding tracking device:", error);
      toast({
        title: "Error",
        description: "Failed to add tracking device",
        variant: "destructive",
      });
    }
  };

  const handleAssignDevice = async () => {
    if (!selectedDevice || !selectedVehicleId) return;

    try {
      const response = await fetch(`/api/vehicles/tracking-devices/${selectedDevice.id}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vehicleId: selectedVehicleId,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Device assigned to vehicle successfully",
        });
        setIsAssignDialogOpen(false);
        setSelectedVehicleId("");
        fetchDevices();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to assign device",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error assigning device:", error);
      toast({
        title: "Error",
        description: "Failed to assign device",
        variant: "destructive",
      });
    }
  };

  const handleUnassignDevice = async (deviceId: string) => {
    try {
      const response = await fetch(`/api/vehicles/tracking-devices/${deviceId}/unassign`, {
        method: "POST",
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Device unassigned successfully",
        });
        fetchDevices();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to unassign device",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error unassigning device:", error);
      toast({
        title: "Error",
        description: "Failed to unassign device",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm("Are you sure you want to delete this device?")) return;

    try {
      const response = await fetch(`/api/vehicles/tracking-devices/${deviceId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Device deleted successfully",
        });
        fetchDevices();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to delete device",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting device:", error);
      toast({
        title: "Error",
        description: "Failed to delete device",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800 border-green-200";
      case "INACTIVE":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "MAINTENANCE":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "DISCONNECTED":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getDeviceTypeIcon = (type: string) => {
    switch (type) {
      case "GPS_TRACKER":
        return <Wifi className="h-4 w-4" />;
      case "OBD_DEVICE":
        return <Cpu className="h-4 w-4" />;
      case "ASSET_TRACKER":
        return <HardDrive className="h-4 w-4" />;
      case "DASH_CAM":
        return <Truck className="h-4 w-4" />;
      case "TEMPERATURE_MONITOR":
        return <PlugZap className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const formatLastPing = (lastPing: string | null) => {
    if (!lastPing) return "Never";
    
    const pingDate = new Date(lastPing);
    const now = new Date();
    const diffMs = now.getTime() - pingDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      return format(pingDate, 'MMM d, yyyy HH:mm');
    }
  };

  const getBatteryIcon = (level: number | null) => {
    if (level === null) return <Battery className="h-4 w-4 text-gray-400" />;
    
    if (level > 75) {
      return <Battery className="h-4 w-4 text-green-500" />;
    } else if (level > 25) {
      return <Battery className="h-4 w-4 text-yellow-500" />;
    } else {
      return <Battery className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>External Tracking Devices</CardTitle>
            <CardDescription>Manage hardware tracking devices for your vehicles</CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>Add Device</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="active">Active Devices</TabsTrigger>
            <TabsTrigger value="all">All Devices</TabsTrigger>
            <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="mt-4">
            {renderDeviceList(devices.filter(d => d.status === "ACTIVE"))}
          </TabsContent>
          
          <TabsContent value="all" className="mt-4">
            {renderDeviceList(devices)}
          </TabsContent>
          
          <TabsContent value="unassigned" className="mt-4">
            {renderDeviceList(devices.filter(d => !d.vehicleId))}
          </TabsContent>
        </Tabs>

        {/* Add Device Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Tracking Device</DialogTitle>
              <DialogDescription>
                Enter the details of the external tracking device to add it to your system.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  className="col-span-3"
                  placeholder="GPS Tracker #1"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="deviceId" className="text-right">
                  Device ID
                </Label>
                <Input
                  id="deviceId"
                  value={newDevice.deviceId}
                  onChange={(e) => setNewDevice({ ...newDevice, deviceId: e.target.value })}
                  className="col-span-3"
                  placeholder="IMEI or Serial Number"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Type
                </Label>
                <Select
                  value={newDevice.type}
                  onValueChange={(value) => setNewDevice({ ...newDevice, type: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select device type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GPS_TRACKER">GPS Tracker</SelectItem>
                    <SelectItem value="OBD_DEVICE">OBD Device</SelectItem>
                    <SelectItem value="ASSET_TRACKER">Asset Tracker</SelectItem>
                    <SelectItem value="DASH_CAM">Dash Cam</SelectItem>
                    <SelectItem value="TEMPERATURE_MONITOR">Temperature Monitor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddDevice}>Add Device</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Device Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Assign Device to Vehicle</DialogTitle>
              <DialogDescription>
                Select a vehicle to assign this tracking device to.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="device" className="text-right">
                  Device
                </Label>
                <div className="col-span-3">
                  <p className="text-sm font-medium">{selectedDevice?.name}</p>
                  <p className="text-xs text-gray-500">{selectedDevice?.deviceId}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="vehicle" className="text-right">
                  Vehicle
                </Label>
                <Select
                  value={selectedVehicleId}
                  onValueChange={setSelectedVehicleId}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} ({vehicle.plateNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignDevice}>Assign Device</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );

  function renderDeviceList(deviceList: TrackingDevice[]) {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center p-4 border rounded-lg">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="ml-4 space-y-2 flex-1">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (deviceList.length === 0) {
      return (
        <div className="text-center py-10">
          <Wifi className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No devices found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding a new tracking device.</p>
          <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
            Add Device
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {deviceList.map((device) => (
          <div key={device.id} className="flex flex-col p-4 border rounded-lg hover:bg-slate-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                  {getDeviceTypeIcon(device.type)}
                </div>
                <div className="ml-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{device.name}</h3>
                    <Badge variant="outline" className={getStatusBadgeColor(device.status)}>
                      {device.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">ID: {device.deviceId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedDevice(device);
                    setSelectedVehicleId(device.vehicleId || "");
                    setIsAssignDialogOpen(true);
                  }}
                >
                  {device.vehicleId ? "Reassign" : "Assign"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDevice(device.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center text-xs text-gray-500">
                <Calendar className="h-3 w-3 mr-1" />
                <span>Adde: {format(new Date(device.createdAt), 'MMM d, yyyy')}</span>
              </div>
              
              <div className="flex items-center text-xs text-gray-500">
                <Wifi className="h-3 w-3 mr-1" />
                <span>Last ping: {formatLastPing(device.lastPing)}</span>
              </div>
              
              {device.batteryLevel !== null && (
                <div className="flex items-center text-xs text-gray-500">
                  {getBatteryIcon(device.batteryLevel)}
                  <span className="ml-1">Battery: {device.batteryLevel}%</span>
                </div>
              )}
              
              {device.firmwareVersion && (
                <div className="flex items-center text-xs text-gray-500">
                  <Cpu className="h-3 w-3 mr-1" />
                  <span>Firmware: {device.firmwareVersion}</span>
                </div>
              )}
            </div>
            
            {device.vehicleId && device.vehicle && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Truck className="h-4 w-4 text-gray-500" />
                    <span className="ml-2 text-sm">Assigned to: <span className="font-medium">{device.vehicle.name}</span> ({device.vehicle.plateNumber})</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnassignDevice(device.id)}
                  >
                    Unassign
                  </Button>
                </div>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  <span className="ml-2 text-xs text-gray-500">API Key: {device.apiKey.substring(0, 8)}...</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(device.apiKey);
                    toast({
                      title: "API Key Copied",
                      description: "The API key has been copied to your clipboard",
                    });
                  }}
                >
                  Copy API Key
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
}