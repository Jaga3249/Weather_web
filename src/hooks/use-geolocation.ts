// import { useState, useEffect } from "react";
// import type { Coordinates } from "@/api/types";

// interface GeolocationState {
//   coordinates: Coordinates | null;
//   error: string | null;
//   isLoading: boolean;
// }

// export function useGeolocation() {
//   const [locationData, setLocationData] = useState<GeolocationState>({
//     coordinates: null,
//     error: null,
//     isLoading: true,
//   });

//   const getLocation = () => {
//     setLocationData((prev) => ({ ...prev, isLoading: true, error: null }));

//     if (!navigator.geolocation) {
//       setLocationData({
//         coordinates: null,
//         error: "Geolocation is not supported by your browser",
//         isLoading: false,
//       });
//       return;
//     }

//     navigator.geolocation.getCurrentPosition(
//       (position) => {
//         setLocationData({
//           coordinates: {
//             lat: position.coords.latitude,
//             lon: position.coords.longitude,
//           },
//           error: null,
//           isLoading: false,
//         });
//       },
//       (error) => {
//         let errorMessage: string;

//         switch (error.code) {
//           case error.PERMISSION_DENIED:
//             errorMessage =
//               "Location permission denied. Please enable location access.";
//             break;
//           case error.POSITION_UNAVAILABLE:
//             errorMessage = "Location information is unavailable.";
//             break;
//           case error.TIMEOUT:
//             errorMessage = "Location request timed out.";
//             break;
//           default:
//             errorMessage = "An unknown error occurred.";
//         }

//         setLocationData({
//           coordinates: null,
//           error: errorMessage,
//           isLoading: false,
//         });
//       },
//       {
//         enableHighAccuracy: true,
//         timeout: 5000,
//         maximumAge: 0,
//       }
//     );
//   };

//   // Get location on component mount
//   useEffect(() => {
//     getLocation();
//   }, []);

//   return {
//     ...locationData,
//     getLocation, // Expose method to manually refresh location
//   };
// }

import { useState, useEffect, useCallback } from "react";
import type { Coordinates } from "@/api/types";

interface GeolocationState {
  coordinates: Coordinates | null;
  error: string | null;
  isLoading: boolean;
}

export function useGeolocation() {
  const [locationData, setLocationData] = useState<GeolocationState>({
    coordinates: null,
    error: null,
    isLoading: true,
  });

  const getLocationWithFallback = useCallback(async () => {
    setLocationData((prev) => ({ ...prev, isLoading: true, error: null }));

    if (!navigator.geolocation) {
      setLocationData({
        coordinates: null,
        error: "Geolocation is not supported by your browser",
        isLoading: false,
      });
      return;
    }

    // Try high accuracy first
    const tryHighAccuracy = () => {
      return new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        });
      });
    };

    // Fallback to lower accuracy
    const tryLowAccuracy = () => {
      return new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 600000, // 10 minutes
        });
      });
    };

    // Try IP geolocation as last resort
    const tryIPGeolocation = async (): Promise<Coordinates> => {
      try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();
        if (data.latitude && data.longitude) {
          return {
            lat: data.latitude,
            lon: data.longitude,
          };
        }
        throw new Error("Invalid IP geolocation response");
      } catch (error) {
        throw new Error("IP geolocation failed");
      }
    };

    try {
      // Try high accuracy first
      const position = await tryHighAccuracy();
      setLocationData({
        coordinates: {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        },
        error: null,
        isLoading: false,
      });
    } catch (highAccuracyError: any) {
      console.log(
        "High accuracy failed, trying low accuracy:",
        highAccuracyError.message
      );

      try {
        // Try low accuracy
        const position = await tryLowAccuracy();
        setLocationData({
          coordinates: {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          },
          error: null,
          isLoading: false,
        });
      } catch (lowAccuracyError: any) {
        console.log(
          "Low accuracy failed, trying IP geolocation:",
          lowAccuracyError.message
        );

        try {
          // Try IP geolocation as last resort
          const coordinates = await tryIPGeolocation();
          setLocationData({
            coordinates,
            error: null,
            isLoading: false,
          });
        } catch (ipError: any) {
          // All methods failed
          let errorMessage: string;

          // Use the most relevant error from GPS attempts
          const gpsError = lowAccuracyError || highAccuracyError;

          switch (gpsError?.code) {
            case 1: // PERMISSION_DENIED
              errorMessage =
                "Location permission denied. Please enable location access in your browser settings.";
              break;
            case 2: // POSITION_UNAVAILABLE
              errorMessage =
                "Location is currently unavailable. Please check your GPS/WiFi connection and try again.";
              break;
            case 3: // TIMEOUT
              errorMessage = "Location request timed out. Please try again.";
              break;
            default:
              errorMessage =
                "Unable to determine your location. Please enable location services and try again.";
          }

          setLocationData({
            coordinates: null,
            error: errorMessage,
            isLoading: false,
          });
        }
      }
    }
  }, []);

  // Simpler method for manual refresh (maintains backward compatibility)
  const getLocation = useCallback(() => {
    getLocationWithFallback();
  }, [getLocationWithFallback]);

  // Get location on component mount
  useEffect(() => {
    getLocationWithFallback();
  }, [getLocationWithFallback]);

  return {
    ...locationData,
    getLocation,
  };
}
