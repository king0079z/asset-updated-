import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Map, { Marker, NavigationControl } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Share, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import Head from "next/head";

export default function SharedAssetLocation() {
  const router = useRouter();
  const { toast } = useToast();
  const { lat, lng, id } = router.query;
  
  const [viewState, setViewState] = useState({
    latitude: parseFloat(lat as string) || 25.2867,
    longitude: parseFloat(lng as string) || 51.5333,
    zoom: 15
  });
  
  const [assetDetails, setAssetDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (lat && lng) {
      setViewState({
        latitude: parseFloat(lat as string),
        longitude: parseFloat(lng as string),
        zoom: 15
      });
      
      // Fetch basic asset details if ID is provided
      if (id) {
        fetch(`/api/assets/${id}`)
          .then(res => {
            if (res.ok) return res.json();
            throw new Error('Failed to fetch asset details');
          })
          .then(data => {
            setAssetDetails(data);
          })
          .catch(err => {
            console.error('Error fetching asset details:', err);
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    }
  }, [lat, lng, id]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        toast({
          title: "Link copied!",
          description: "The location link has been copied to your clipboard.",
        });
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        toast({
          title: "Failed to copy",
          description: "Please try again or copy the URL manually.",
          variant: "destructive"
        });
      });
  };

  const openInMaps = () => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    }
  };

  if (!lat || !lng) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle className="text-center">Invalid Location</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              This shared location link is invalid or has expired.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => router.push('/asset-location')}>
              Go to Asset Locations
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Shared Asset Location | Enterprise Asset Management</title>
        <meta name="description" content="View shared asset location" />
      </Head>
      
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b p-4">
          <div className="container flex justify-between items-center">
            <h1 className="text-xl font-bold">Shared Asset Location</h1>
            <Button variant="outline" onClick={() => router.push('/asset-location')}>
              View All Assets
            </Button>
          </div>
        </header>
        
        <main className="flex-1 container py-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <div className="h-[500px]">
                <Map
                  {...viewState}
                  onMove={evt => setViewState(evt.viewState)}
                  mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
                  style={{ width: "100%", height: "100%" }}
                  mapStyle="mapbox://styles/mapbox/streets-v11"
                >
                  <NavigationControl position="top-right" />
                  <Marker
                    latitude={parseFloat(lat as string)}
                    longitude={parseFloat(lng as string)}
                  >
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white text-sm shadow-lg border-2 border-white">
                      <MapPin className="h-6 w-6" />
                    </div>
                  </Marker>
                </Map>
              </div>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Location Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="space-y-2">
                    <div className="h-6 bg-muted rounded animate-pulse" />
                    <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                    <div className="h-4 bg-muted rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    {assetDetails ? (
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-medium">Asset Name</h3>
                          <p>{assetDetails.name}</p>
                        </div>
                        
                        {assetDetails.description && (
                          <div>
                            <h3 className="font-medium">Description</h3>
                            <p className="text-sm text-muted-foreground">{assetDetails.description}</p>
                          </div>
                        )}
                        
                        {assetDetails.location?.address && (
                          <div>
                            <h3 className="font-medium">Address</h3>
                            <p className="text-sm">{assetDetails.location.address}</p>
                          </div>
                        )}

                        <div>
                          <h3 className="font-medium">Google Maps</h3>
                          <div className="flex items-center mt-1">
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline flex items-center"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" /> 
                              View on Google Maps
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-medium">Coordinates</h3>
                          <p className="text-sm">
                            Latitude: {parseFloat(lat as string).toFixed(6)}<br />
                            Longitude: {parseFloat(lng as string).toFixed(6)}
                          </p>
                        </div>
                        
                        <div>
                          <h3 className="font-medium">Google Maps</h3>
                          <div className="flex items-center mt-1">
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline flex items-center"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" /> 
                              View on Google Maps
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
              <CardFooter className="flex flex-col space-y-2">
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={copyToClipboard}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy Link
                </Button>
                <Button 
                  className="w-full" 
                  onClick={openInMaps}
                >
                  <ExternalLink className="mr-2 h-4 w-4" /> Open in Google Maps
                </Button>
              </CardFooter>
            </Card>
          </div>
        </main>
      </div>
    </>
  );
}