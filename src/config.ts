export interface Config {
  baseUrl: string;
  apiToken?: string;
}

export function loadConfig(): Config {
  const baseUrl = process.env.EVA_BASE_URL ?? "https://www.evateam.ru";
  const apiToken = process.env.EVA_API_TOKEN;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    ...(apiToken ? { apiToken } : {}),
  };
}
