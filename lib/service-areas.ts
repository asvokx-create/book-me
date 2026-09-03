export type ServiceArea = {
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

export const SERVICE_AREAS: ServiceArea[] = [
  { city: "Issaquah", state: "WA", latitude: 47.5301, longitude: -122.0326 },
  { city: "Sammamish", state: "WA", latitude: 47.6163, longitude: -122.0356 },
  { city: "Newcastle", state: "WA", latitude: 47.5389, longitude: -122.1557 },
  { city: "Mercer Island", state: "WA", latitude: 47.5707, longitude: -122.2221 },
  { city: "Bellevue", state: "WA", latitude: 47.6101, longitude: -122.2015 },
  { city: "Renton", state: "WA", latitude: 47.4829, longitude: -122.2171 },
  { city: "Redmond", state: "WA", latitude: 47.674, longitude: -122.1215 },
  { city: "Kirkland", state: "WA", latitude: 47.6769, longitude: -122.206 },
  { city: "Maple Valley", state: "WA", latitude: 47.3927, longitude: -122.0464 },
  { city: "Snoqualmie", state: "WA", latitude: 47.5287, longitude: -121.8254 },
  { city: "North Bend", state: "WA", latitude: 47.4957, longitude: -121.7868 },
  { city: "Seattle", state: "WA", latitude: 47.6062, longitude: -122.3321 },
  { city: "Kent", state: "WA", latitude: 47.3809, longitude: -122.2348 },
  { city: "Bothell", state: "WA", latitude: 47.7623, longitude: -122.2054 },
  { city: "Woodinville", state: "WA", latitude: 47.7543, longitude: -122.1635 },
];

export function serviceAreaLabel(area: ServiceArea) {
  return `${area.city}, ${area.state}`;
}

function normalizeLocation(location: string) {
  return location.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getServiceAreaCoordinates(location: string) {
  const normalized = normalizeLocation(location);
  return SERVICE_AREAS.find((area) => {
    const full = normalizeLocation(serviceAreaLabel(area));
    return normalized === full || normalized === normalizeLocation(area.city);
  });
}

export function distanceMiles(from: Pick<ServiceArea, "latitude" | "longitude">, to: Pick<ServiceArea, "latitude" | "longitude">) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversine));
}

export function nearbyServiceAreas(location: string, limit = 8) {
  const origin = getServiceAreaCoordinates(location) ?? SERVICE_AREAS[0];
  return SERVICE_AREAS
    .map((area) => ({ ...area, distance: distanceMiles(origin, area) }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, limit);
}

export function closestServiceArea(latitude: number, longitude: number) {
  const origin = { latitude, longitude };
  return SERVICE_AREAS.reduce((closest, area) => distanceMiles(origin, area) < distanceMiles(origin, closest) ? area : closest, SERVICE_AREAS[0]);
}
