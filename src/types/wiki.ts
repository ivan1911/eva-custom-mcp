export type EvaApiFilter = unknown[];
export type EvaApiSlice = [number, number];

export interface EvaApiQuery {
  filter?: EvaApiFilter;
  fields?: string[];
  slice?: EvaApiSlice;
  order_by?: string[];
  include_archived?: boolean;
}

export interface WikiDocument {
  code?: string;
  id?: string;
  name?: string;
  text?: string;
  text_draft?: string;
  tree_parent?: string;
  parent?: string;
  cmf_created_at?: string;
  cmf_updated_at?: string;
  [key: string]: unknown;
}

export interface WikiAttachment {
  code?: string;
  id?: string;
  name?: string;
  parent?: string;
  url?: string;
  cmf_created_at?: string;
  cmf_updated_at?: string;
  [key: string]: unknown;
}

export interface WikiDocumentMutation {
  name?: string;
  text_draft?: string;
  tree_parent?: string;
  parent?: string;
  cmf_owner?: string;
  responsible?: string;
  executors?: string[];
  spectators?: string[];
  tags?: string[];
  full_screen?: boolean;
  categories?: string[];
}
