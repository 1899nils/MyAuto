let mapsLoaded = false;
let mapsLoading: Promise<void> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (mapsLoaded) return Promise.resolve();
  if (mapsLoading) return mapsLoading;

  mapsLoading = new Promise((resolve, reject) => {
    if (document.getElementById('google-maps-script')) {
      // Script tag already exists – poll until google.maps is ready
      const t = setInterval(() => {
        if ((window as unknown as { google?: { maps?: unknown } }).google?.maps) {
          clearInterval(t);
          mapsLoaded = true;
          resolve();
        }
      }, 50);
      setTimeout(() => { clearInterval(t); reject(new Error('Maps timeout')); }, 10000);
      return;
    }

    let resolved = false;
    function done() {
      if (resolved) return;
      resolved = true;
      mapsLoaded = true;
      resolve();
    }

    // Callback fires when Maps has fully initialised (preferred)
    const cb = '__mapsReady';
    (window as unknown as Record<string, unknown>)[cb] = () => {
      delete (window as unknown as Record<string, unknown>)[cb];
      done();
    };

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&callback=${cb}`;
    script.async = true;

    // onload is a safety net: if callback isn't called (API key issue etc.)
    // we resolve after a short grace period so the app doesn't freeze
    script.onload = () => setTimeout(done, 300);
    script.onerror = () => {
      mapsLoading = null;
      reject(new Error('Google Maps failed to load'));
    };

    document.head.appendChild(script);
  });

  return mapsLoading;
}

export function createTrafficLayer(): google.maps.TrafficLayer {
  return new google.maps.TrafficLayer();
}

export function createPolyline(path: google.maps.LatLngLiteral[]): google.maps.Polyline {
  return new google.maps.Polyline({
    path,
    geodesic: true,
    strokeColor: '#007AFF',
    strokeOpacity: 0.9,
    strokeWeight: 5,
  });
}

export function createMarker(position: google.maps.LatLngLiteral, label: string, map: google.maps.Map): google.maps.Marker {
  return new google.maps.Marker({
    position,
    map,
    label: { text: label, fontSize: '20px' },
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 0,
    },
  });
}

export async function reverseGeocode(lat: number, lng: number, apiKey: string): Promise<string> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=de&result_type=street_address|route`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.results?.[0]) {
    const r = data.results[0];
    const street = r.address_components.find((c: { types: string[] }) => c.types.includes('route'))?.long_name ?? '';
    const num = r.address_components.find((c: { types: string[] }) => c.types.includes('street_number'))?.long_name ?? '';
    const city = r.address_components.find((c: { types: string[] }) =>
      c.types.includes('locality') || c.types.includes('administrative_area_level_2')
    )?.long_name ?? '';
    return [street, num, city].filter(Boolean).join(' ');
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export async function getDirectionsWithTraffic(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
  departureTime: Date
): Promise<{
  polyline: string;
  distanceKm: number;
  durationSeconds: number;
  trafficDelaySeconds: number;
}> {
  return new Promise((resolve, reject) => {
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime,
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      },
      (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result) {
          reject(new Error(`Directions failed: ${status}`));
          return;
        }
        const leg = result.routes[0].legs[0];
        const polyline = result.routes[0].overview_polyline;
        const durationNormal = leg.duration?.value ?? 0;
        const durationTraffic = leg.duration_in_traffic?.value ?? durationNormal;

        resolve({
          polyline,
          distanceKm: (leg.distance?.value ?? 0) / 1000,
          durationSeconds: durationTraffic,
          trafficDelaySeconds: Math.max(0, durationTraffic - durationNormal),
        });
      }
    );
  });
}
