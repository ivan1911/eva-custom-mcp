export interface Config {
  baseUrl: string;
  glossaryUrl: string;
  apiToken?: string;
  userLogin?: string;
  uploadRoot?: string;
}

const PUBLIC_EVATEAM_URL = "https://www.evateam.ru";

export function loadConfig(): Config {
  const baseUrl = process.env.EVA_BASE_URL ?? PUBLIC_EVATEAM_URL;
  const glossaryUrl = process.env.EVA_GLOSSARY_URL ?? PUBLIC_EVATEAM_URL;
  const apiToken = process.env.EVA_API_TOKEN;
  const userLogin = process.env.EVA_USER_LOGIN;
  const uploadRoot = process.env.EVA_UPLOAD_ROOT;

  return {
    baseUrl: trimTrailingSlashes(baseUrl),
    glossaryUrl: trimTrailingSlashes(glossaryUrl),
    ...(apiToken ? { apiToken } : {}),
    ...(userLogin ? { userLogin } : {}),
    ...(uploadRoot ? { uploadRoot } : {}),
  };
}

function trimTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}
