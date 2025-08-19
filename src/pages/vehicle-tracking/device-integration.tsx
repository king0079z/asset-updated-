import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Copy, HardDrive, Info, Server, Truck, Wifi } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function DeviceIntegrationPage() {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "The code has been copied to your clipboard",
    });
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">External Device Integration</h1>
            <p className="text-muted-foreground">
              Learn how to integrate external tracking devices with your vehicle fleet
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              External tracking devices must be registered in the system before they can send data. 
              Go to the Vehicle Tracking page and select the "Devices" tab to add your devices.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="api">API Reference</TabsTrigger>
              <TabsTrigger value="examples">Code Examples</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>External Device Integration Overview</CardTitle>
                  <CardDescription>
                    How to connect hardware tracking devices to your vehicle fleet management system
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Supported Device Types</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="flex items-start p-4 border rounded-lg">
                        <Wifi className="h-5 w-5 mr-3 text-blue-500" />
                        <div>
                          <h4 className="font-medium">GPS Trackers</h4>
                          <p className="text-sm text-gray-500">Standard GPS tracking devices that report location data</p>
                        </div>
                      </div>
                      <div className="flex items-start p-4 border rounded-lg">
                        <HardDrive className="h-5 w-5 mr-3 text-green-500" />
                        <div>
                          <h4 className="font-medium">OBD Devices</h4>
                          <p className="text-sm text-gray-500">On-board diagnostic devices that connect to the vehicle's OBD-II port</p>
                        </div>
                      </div>
                      <div className="flex items-start p-4 border rounded-lg">
                        <Truck className="h-5 w-5 mr-3 text-purple-500" />
                        <div>
                          <h4 className="font-medium">Asset Trackers</h4>
                          <p className="text-sm text-gray-500">Specialized trackers for monitoring valuable assets</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Integration Process</h3>
                    <ol className="list-decimal list-inside space-y-4 pl-4">
                      <li className="pl-2">
                        <span className="font-medium">Register your device</span>
                        <p className="text-sm text-gray-500 mt-1">Add your device in the "Devices" tab of the Vehicle Tracking page. You'll need the device's unique identifier (IMEI, serial number, etc.).</p>
                      </li>
                      <li className="pl-2">
                        <span className="font-medium">Get your API key</span>
                        <p className="text-sm text-gray-500 mt-1">Each device has a unique API key that must be used when sending data to our system.</p>
                      </li>
                      <li className="pl-2">
                        <span className="font-medium">Configure your device</span>
                        <p className="text-sm text-gray-500 mt-1">Program your device to send location data to our API endpoint using the provided API key.</p>
                      </li>
                      <li className="pl-2">
                        <span className="font-medium">Assign to a vehicle</span>
                        <p className="text-sm text-gray-500 mt-1">Once your device is sending data, assign it to a specific vehicle in your fleet.</p>
                      </li>
                    </ol>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Data Requirements</h3>
                    <p className="text-sm text-gray-500">
                      At minimum, your device must send latitude and longitude coordinates. Additional data such as speed, heading, altitude, and battery level are optional but recommended for better tracking.
                    </p>
                    <div className="mt-4 p-4 bg-slate-50 rounded-md">
                      <h4 className="text-sm font-medium mb-2">Required Fields:</h4>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        <li>latitude (number): GPS latitude coordinate</li>
                        <li>longitude (number): GPS longitude coordinate</li>
                      </ul>
                      
                      <h4 className="text-sm font-medium mt-4 mb-2">Optional Fields:</h4>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        <li>altitude (number): Altitude in meters</li>
                        <li>speed (number): Speed in km/h</li>
                        <li>heading (number): Direction in degrees (0-360)</li>
                        <li>accuracy (number): GPS accuracy in meters</li>
                        <li>batteryLevel (number): Device battery level (0-100)</li>
                        <li>timestamp (ISO date string): Time of the location reading</li>
                        <li>metadata (object): Any additional device-specific data</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="api" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>API Reference</CardTitle>
                  <CardDescription>
                    Technical details for integrating external tracking devices
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">API Endpoint</h3>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-md">
                      <code className="text-sm">POST /api/vehicles/device-tracking</code>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard('POST /api/vehicles/device-tracking')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Authentication</h3>
                    <p className="text-sm text-gray-500">
                      Authentication is done using the API key assigned to your device. You can provide the API key in one of two ways:
                    </p>
                    <div className="mt-2 space-y-4">
                      <div className="p-4 bg-slate-50 rounded-md">
                        <h4 className="text-sm font-medium mb-2">1. HTTP Header:</h4>
                        <div className="flex items-center justify-between">
                          <code className="text-sm">X-API-Key: your_api_key_here</code>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard('X-API-Key: your_api_key_here')}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-md">
                        <h4 className="text-sm font-medium mb-2">2. Query Parameter:</h4>
                        <div className="flex items-center justify-between">
                          <code className="text-sm">/api/vehicles/device-tracking?apiKey=your_api_key_here</code>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard('/api/vehicles/device-tracking?apiKey=your_api_key_here')}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Request Body</h3>
                    <p className="text-sm text-gray-500">
                      The request body should be a JSON object containing the location data:
                    </p>
                    <div className="mt-2 p-4 bg-slate-50 rounded-md relative">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "altitude": 10.5,
  "speed": 45.2,
  "heading": 90.5,
  "accuracy": 5.0,
  "batteryLevel": 85,
  "timestamp": "2023-05-15T14:30:00Z",
  "metadata": {
    "engineStatus": "running",
    "fuelLevel": 75,
    "temperature": 24.5
  }
}`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <pre className="text-xs overflow-auto p-2">
{`{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "altitude": 10.5,
  "speed": 45.2,
  "heading": 90.5,
  "accuracy": 5.0,
  "batteryLevel": 85,
  "timestamp": "2023-05-15T14:30:00Z",
  "metadata": {
    "engineStatus": "running",
    "fuelLevel": 75,
    "temperature": 24.5
  }
}`}
                      </pre>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Response</h3>
                    <p className="text-sm text-gray-500">
                      A successful request will return a 200 OK response with a JSON body:
                    </p>
                    <div className="mt-2 p-4 bg-slate-50 rounded-md relative">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`{
  "success": true,
  "message": "Location data received successfully",
  "deviceId": "device123",
  "locationId": "loc_abc123",
  "timestamp": "2023-05-15T14:30:00Z"
}`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <pre className="text-xs overflow-auto p-2">
{`{
  "success": true,
  "message": "Location data received successfully",
  "deviceId": "device123",
  "locationId": "loc_abc123",
  "timestamp": "2023-05-15T14:30:00Z"
}`}
                      </pre>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Error Responses</h3>
                    <div className="mt-2 space-y-4">
                      <div className="p-4 bg-slate-50 rounded-md">
                        <h4 className="text-sm font-medium mb-2">401 Unauthorized:</h4>
                        <pre className="text-xs overflow-auto p-2">
{`{
  "error": "API key is required"
}

// or

{
  "error": "Invalid API key"
}`}
                        </pre>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-md">
                        <h4 className="text-sm font-medium mb-2">400 Bad Request:</h4>
                        <pre className="text-xs overflow-auto p-2">
{`{
  "error": "Invalid location data. Latitude and longitude must be numbers."
}

// or

{
  "error": "Invalid coordinates",
  "message": "The provided coordinates are outside valid ranges."
}`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="examples" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Code Examples</CardTitle>
                  <CardDescription>
                    Sample code for integrating different types of devices
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Tabs defaultValue="arduino" className="w-full">
                    <TabsList className="grid w-full max-w-md grid-cols-4">
                      <TabsTrigger value="arduino">Arduino</TabsTrigger>
                      <TabsTrigger value="python">Python</TabsTrigger>
                      <TabsTrigger value="nodejs">Node.js</TabsTrigger>
                      <TabsTrigger value="curl">cURL</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="arduino" className="mt-4">
                      <div className="p-4 bg-slate-50 rounded-md relative">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(`#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <TinyGPS++.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// API endpoint and key
const char* serverUrl = "https://your-domain.com/api/vehicles/device-tracking";
const char* apiKey = "YOUR_DEVICE_API_KEY";

// GPS module connected to Serial2
TinyGPSPlus gps;

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600); // GPS module baud rate
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");
}

void loop() {
  // Read GPS data
  while (Serial2.available() > 0) {
    if (gps.encode(Serial2.read())) {
      if (gps.location.isValid()) {
        sendLocationData();
      }
    }
  }
  
  // Send location every 30 seconds
  delay(30000);
}

void sendLocationData() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected");
    return;
  }
  
  // Create JSON document
  DynamicJsonDocument doc(1024);
  doc["latitude"] = gps.location.lat();
  doc["longitude"] = gps.location.lng();
  doc["altitude"] = gps.altitude.meters();
  doc["speed"] = gps.speed.kmph();
  doc["heading"] = gps.course.deg();
  doc["accuracy"] = 5.0; // Estimated accuracy in meters
  doc["batteryLevel"] = 85; // Battery level in percentage
  
  // Add metadata
  JsonObject metadata = doc.createNestedObject("metadata");
  metadata["temperature"] = 24.5; // Example sensor data
  
  // Serialize JSON to string
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Send HTTP POST request
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", apiKey);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("HTTP Response code: " + String(httpResponseCode));
    Serial.println(response);
  } else {
    Serial.println("Error on sending POST: " + String(httpResponseCode));
  }
  
  http.end();
}`)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <pre className="text-xs overflow-auto p-2 max-h-96">
{`#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <TinyGPS++.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// API endpoint and key
const char* serverUrl = "https://your-domain.com/api/vehicles/device-tracking";
const char* apiKey = "YOUR_DEVICE_API_KEY";

// GPS module connected to Serial2
TinyGPSPlus gps;

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600); // GPS module baud rate
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");
}

void loop() {
  // Read GPS data
  while (Serial2.available() > 0) {
    if (gps.encode(Serial2.read())) {
      if (gps.location.isValid()) {
        sendLocationData();
      }
    }
  }
  
  // Send location every 30 seconds
  delay(30000);
}

void sendLocationData() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected");
    return;
  }
  
  // Create JSON document
  DynamicJsonDocument doc(1024);
  doc["latitude"] = gps.location.lat();
  doc["longitude"] = gps.location.lng();
  doc["altitude"] = gps.altitude.meters();
  doc["speed"] = gps.speed.kmph();
  doc["heading"] = gps.course.deg();
  doc["accuracy"] = 5.0; // Estimated accuracy in meters
  doc["batteryLevel"] = 85; // Battery level in percentage
  
  // Add metadata
  JsonObject metadata = doc.createNestedObject("metadata");
  metadata["temperature"] = 24.5; // Example sensor data
  
  // Serialize JSON to string
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Send HTTP POST request
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", apiKey);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("HTTP Response code: " + String(httpResponseCode));
    Serial.println(response);
  } else {
    Serial.println("Error on sending POST: " + String(httpResponseCode));
  }
  
  http.end();
}`}
                        </pre>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="python" className="mt-4">
                      <div className="p-4 bg-slate-50 rounded-md relative">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(`import requests
import json
import time
from datetime import datetime
import random  # For demo purposes only

# API endpoint and key
SERVER_URL = "https://your-domain.com/api/vehicles/device-tracking"
API_KEY = "YOUR_DEVICE_API_KEY"

# In a real implementation, you would get these values from a GPS module
def get_gps_data():
    # This is just a simulation - replace with actual GPS data in production
    return {
        "latitude": 37.7749 + (random.random() - 0.5) * 0.01,
        "longitude": -122.4194 + (random.random() - 0.5) * 0.01,
        "altitude": 10.5 + random.random() * 5,
        "speed": 45.2 + (random.random() - 0.5) * 10,
        "heading": random.random() * 360,
        "accuracy": 3.0 + random.random() * 5
    }

def get_device_status():
    # This would come from sensors in a real implementation
    return {
        "batteryLevel": 85 - random.randint(0, 10),
        "engineStatus": "running" if random.random() > 0.2 else "idle",
        "fuelLevel": 75 - random.randint(0, 5),
        "temperature": 24.5 + (random.random() - 0.5) * 5
    }

def send_location_data():
    # Get GPS data
    gps_data = get_gps_data()
    
    # Get device status
    device_status = get_device_status()
    
    # Prepare payload
    payload = {
        **gps_data,
        "batteryLevel": device_status["batteryLevel"],
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "metadata": {
            "engineStatus": device_status["engineStatus"],
            "fuelLevel": device_status["fuelLevel"],
            "temperature": device_status["temperature"]
        }
    }
    
    # Send HTTP request
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
    }
    
    try:
        response = requests.post(SERVER_URL, headers=headers, json=payload)
        
        if response.status_code == 200:
            print(f"Success: {response.json()}")
        else:
            print(f"Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

# Main loop
def main():
    while True:
        send_location_data()
        # Wait for 30 seconds before sending the next update
        time.sleep(30)

if __name__ == "__main__":
    main()`)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <pre className="text-xs overflow-auto p-2 max-h-96">
{`import requests
import json
import time
from datetime import datetime
import random  # For demo purposes only

# API endpoint and key
SERVER_URL = "https://your-domain.com/api/vehicles/device-tracking"
API_KEY = "YOUR_DEVICE_API_KEY"

# In a real implementation, you would get these values from a GPS module
def get_gps_data():
    # This is just a simulation - replace with actual GPS data in production
    return {
        "latitude": 37.7749 + (random.random() - 0.5) * 0.01,
        "longitude": -122.4194 + (random.random() - 0.5) * 0.01,
        "altitude": 10.5 + random.random() * 5,
        "speed": 45.2 + (random.random() - 0.5) * 10,
        "heading": random.random() * 360,
        "accuracy": 3.0 + random.random() * 5
    }

def get_device_status():
    # This would come from sensors in a real implementation
    return {
        "batteryLevel": 85 - random.randint(0, 10),
        "engineStatus": "running" if random.random() > 0.2 else "idle",
        "fuelLevel": 75 - random.randint(0, 5),
        "temperature": 24.5 + (random.random() - 0.5) * 5
    }

def send_location_data():
    # Get GPS data
    gps_data = get_gps_data()
    
    # Get device status
    device_status = get_device_status()
    
    # Prepare payload
    payload = {
        **gps_data,
        "batteryLevel": device_status["batteryLevel"],
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "metadata": {
            "engineStatus": device_status["engineStatus"],
            "fuelLevel": device_status["fuelLevel"],
            "temperature": device_status["temperature"]
        }
    }
    
    # Send HTTP request
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
    }
    
    try:
        response = requests.post(SERVER_URL, headers=headers, json=payload)
        
        if response.status_code == 200:
            print(f"Success: {response.json()}")
        else:
            print(f"Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

# Main loop
def main():
    while True:
        send_location_data()
        # Wait for 30 seconds before sending the next update
        time.sleep(30)

if __name__ == "__main__":
    main()`}
                        </pre>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="nodejs" className="mt-4">
                      <div className="p-4 bg-slate-50 rounded-md relative">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(`const axios = require('axios');

// API endpoint and key
const SERVER_URL = 'https://your-domain.com/api/vehicles/device-tracking';
const API_KEY = 'YOUR_DEVICE_API_KEY';

// In a real implementation, you would get these values from a GPS module
function getGpsData() {
  // This is just a simulation - replace with actual GPS data in production
  return {
    latitude: 37.7749 + (Math.random() - 0.5) * 0.01,
    longitude: -122.4194 + (Math.random() - 0.5) * 0.01,
    altitude: 10.5 + Math.random() * 5,
    speed: 45.2 + (Math.random() - 0.5) * 10,
    heading: Math.random() * 360,
    accuracy: 3.0 + Math.random() * 5
  };
}

function getDeviceStatus() {
  // This would come from sensors in a real implementation
  return {
    batteryLevel: 85 - Math.floor(Math.random() * 10),
    engineStatus: Math.random() > 0.2 ? 'running' : 'idle',
    fuelLevel: 75 - Math.floor(Math.random() * 5),
    temperature: 24.5 + (Math.random() - 0.5) * 5
  };
}

async function sendLocationData() {
  // Get GPS data
  const gpsData = getGpsData();
  
  // Get device status
  const deviceStatus = getDeviceStatus();
  
  // Prepare payload
  const payload = {
    ...gpsData,
    batteryLevel: deviceStatus.batteryLevel,
    timestamp: new Date().toISOString(),
    metadata: {
      engineStatus: deviceStatus.engineStatus,
      fuelLevel: deviceStatus.fuelLevel,
      temperature: deviceStatus.temperature
    }
  };
  
  // Send HTTP request
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  };
  
  try {
    const response = await axios.post(SERVER_URL, payload, { headers });
    console.log('Success:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('Error:', error.response.status, error.response.data);
    } else {
      console.error('Exception:', error.message);
    }
  }
}

// Main function
async function main() {
  while (true) {
    await sendLocationData();
    // Wait for 30 seconds before sending the next update
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
}

main().catch(console.error);`)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <pre className="text-xs overflow-auto p-2 max-h-96">
{`const axios = require('axios');

// API endpoint and key
const SERVER_URL = 'https://your-domain.com/api/vehicles/device-tracking';
const API_KEY = 'YOUR_DEVICE_API_KEY';

// In a real implementation, you would get these values from a GPS module
function getGpsData() {
  // This is just a simulation - replace with actual GPS data in production
  return {
    latitude: 37.7749 + (Math.random() - 0.5) * 0.01,
    longitude: -122.4194 + (Math.random() - 0.5) * 0.01,
    altitude: 10.5 + Math.random() * 5,
    speed: 45.2 + (Math.random() - 0.5) * 10,
    heading: Math.random() * 360,
    accuracy: 3.0 + Math.random() * 5
  };
}

function getDeviceStatus() {
  // This would come from sensors in a real implementation
  return {
    batteryLevel: 85 - Math.floor(Math.random() * 10),
    engineStatus: Math.random() > 0.2 ? 'running' : 'idle',
    fuelLevel: 75 - Math.floor(Math.random() * 5),
    temperature: 24.5 + (Math.random() - 0.5) * 5
  };
}

async function sendLocationData() {
  // Get GPS data
  const gpsData = getGpsData();
  
  // Get device status
  const deviceStatus = getDeviceStatus();
  
  // Prepare payload
  const payload = {
    ...gpsData,
    batteryLevel: deviceStatus.batteryLevel,
    timestamp: new Date().toISOString(),
    metadata: {
      engineStatus: deviceStatus.engineStatus,
      fuelLevel: deviceStatus.fuelLevel,
      temperature: deviceStatus.temperature
    }
  };
  
  // Send HTTP request
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  };
  
  try {
    const response = await axios.post(SERVER_URL, payload, { headers });
    console.log('Success:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('Error:', error.response.status, error.response.data);
    } else {
      console.error('Exception:', error.message);
    }
  }
}

// Main function
async function main() {
  while (true) {
    await sendLocationData();
    // Wait for 30 seconds before sending the next update
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
}

main().catch(console.error);`}
                        </pre>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="curl" className="mt-4">
                      <div className="p-4 bg-slate-50 rounded-md relative">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(`curl -X POST \\
  https://your-domain.com/api/vehicles/device-tracking \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_DEVICE_API_KEY" \\
  -d '{
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude": 10.5,
    "speed": 45.2,
    "heading": 90.5,
    "accuracy": 5.0,
    "batteryLevel": 85,
    "timestamp": "2023-05-15T14:30:00Z",
    "metadata": {
      "engineStatus": "running",
      "fuelLevel": 75,
      "temperature": 24.5
    }
  }'`)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <pre className="text-xs overflow-auto p-2">
{`curl -X POST \\
  https://your-domain.com/api/vehicles/device-tracking \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_DEVICE_API_KEY" \\
  -d '{
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude": 10.5,
    "speed": 45.2,
    "heading": 90.5,
    "accuracy": 5.0,
    "batteryLevel": 85,
    "timestamp": "2023-05-15T14:30:00Z",
    "metadata": {
      "engineStatus": "running",
      "fuelLevel": 75,
      "temperature": 24.5
    }
  }'`}
                        </pre>
                      </div>
                      
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Alternative with query parameter:</h4>
                        <div className="p-4 bg-slate-50 rounded-md relative">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(`curl -X POST \\
  "https://your-domain.com/api/vehicles/device-tracking?apiKey=YOUR_DEVICE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude": 10.5,
    "speed": 45.2,
    "heading": 90.5,
    "accuracy": 5.0,
    "batteryLevel": 85,
    "timestamp": "2023-05-15T14:30:00Z",
    "metadata": {
      "engineStatus": "running",
      "fuelLevel": 75,
      "temperature": 24.5
    }
  }'`)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <pre className="text-xs overflow-auto p-2">
{`curl -X POST \\
  "https://your-domain.com/api/vehicles/device-tracking?apiKey=YOUR_DEVICE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude": 10.5,
    "speed": 45.2,
    "heading": 90.5,
    "accuracy": 5.0,
    "batteryLevel": 85,
    "timestamp": "2023-05-15T14:30:00Z",
    "metadata": {
      "engineStatus": "running",
      "fuelLevel": 75,
      "temperature": 24.5
    }
  }'`}
                          </pre>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}