const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? '';

export function getApiBaseUrl(): string {
  return baseUrl.replace(/\/$/, '');
}
