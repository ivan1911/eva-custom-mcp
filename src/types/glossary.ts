export interface GlossaryArticle {
  title: string;
  slug: string;
  url: string;
  publishedAt?: string;
  headings: string[];
  text: string;
}
