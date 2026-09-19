import "server-only";

import cityData from "@/data/us-cities.json";
import { distanceMiles, type ServiceArea } from "@/lib/service-areas";

type UsCityRecord = ServiceArea & { lsad: string };
export type UsCity = ServiceArea;

const cities = cityData as UsCityRecord[];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cityLabel(city: UsCity) {
  return `${city.city}, ${city.state}`;
}

const citiesByLabel = new Map(cities.map((city) => [normalize(cityLabel(city)), city]));

export function findUsCity(value: string) {
  return citiesByLabel.get(normalize(value));
}

export function searchUsCities(query: string, limit = 80) {
  const normalized = normalize(query);
  if (!normalized) return cities.slice(0, limit);
  const terms = normalized.split(" ");
  return cities
    .filter((city) => {
      const searchable = normalize(cityLabel(city));
      return terms.every((term) => searchable.includes(term));
    })
    .sort((left, right) => {
      const leftLabel = normalize(cityLabel(left));
      const rightLabel = normalize(cityLabel(right));
      const leftStarts = leftLabel.startsWith(normalized) ? 0 : 1;
      const rightStarts = rightLabel.startsWith(normalized) ? 0 : 1;
      return leftStarts - rightStarts || left.city.localeCompare(right.city) || left.state.localeCompare(right.state);
    })
    .slice(0, limit);
}

export function nearbyUsCities(value: string, limit = 12) {
  const origin = findUsCity(value);
  if (!origin) return [];
  return cities
    .filter((city) => city.lsad !== "57" && (city.city !== origin.city || city.state !== origin.state))
    .map((city) => ({ city, distance: distanceMiles(origin, city) }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, limit)
    .map(({ city, distance }) => ({ ...city, distance: Math.round(distance * 10) / 10 }));
}

export function nearestUsCities(latitude: number, longitude: number, limit = 12) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
  const origin = { latitude, longitude };
  return cities
    .filter((city) => city.lsad !== "57")
    .map((city) => ({ city, distance: distanceMiles(origin, city) }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, Math.min(Math.max(limit, 1), 30))
    .map(({ city, distance }) => ({ ...city, distance: Math.round(distance * 10) / 10 }));
}
