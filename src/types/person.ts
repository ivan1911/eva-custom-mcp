export interface Person {
  id: string;
  code?: string;
  name?: string;
  login?: string;
  [key: string]: unknown;
}
