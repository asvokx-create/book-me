export const SERVICE_DELIVERY_TYPES = ["IN_PERSON", "REMOTE", "BOTH"] as const;
export type ServiceDeliveryType = typeof SERVICE_DELIVERY_TYPES[number];
export type BookingDeliveryMethod = Exclude<ServiceDeliveryType, "BOTH">;

export const REQUEST_DELIVERY_TYPES = ["IN_PERSON", "REMOTE", "EITHER"] as const;
export type RequestDeliveryType = typeof REQUEST_DELIVERY_TYPES[number];

export function isServiceDeliveryType(value: unknown): value is ServiceDeliveryType {
  return typeof value === "string" && SERVICE_DELIVERY_TYPES.includes(value as ServiceDeliveryType);
}

export function isBookingDeliveryMethod(value: unknown): value is BookingDeliveryMethod {
  return value === "IN_PERSON" || value === "REMOTE";
}

export function isRequestDeliveryType(value: unknown): value is RequestDeliveryType {
  return typeof value === "string" && REQUEST_DELIVERY_TYPES.includes(value as RequestDeliveryType);
}

export function deliveryLabel(value: ServiceDeliveryType | BookingDeliveryMethod | RequestDeliveryType) {
  if (value === "IN_PERSON") return "In person";
  if (value === "REMOTE") return "Remote";
  if (value === "BOTH") return "Remote or in person";
  return "Remote or in person";
}

export function serviceSupportsMethod(service: ServiceDeliveryType, method: BookingDeliveryMethod) {
  return service === "BOTH" || service === method;
}

export function serviceMatchesRequest(service: ServiceDeliveryType, request: RequestDeliveryType) {
  if (request === "EITHER") return true;
  return serviceSupportsMethod(service, request);
}

export function defaultDeliveryForCategory(category: string): ServiceDeliveryType {
  const normalized = category.trim().toLowerCase();
  if (["graphic design", "video editing", "web development", "writing", "writing & editing", "marketing", "digital marketing", "social media", "virtual assistance", "bookkeeping"].includes(normalized)) return "REMOTE";
  if (["tutoring", "consulting", "coaching", "business services"].includes(normalized)) return "BOTH";
  return "IN_PERSON";
}
