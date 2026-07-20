import { z } from "zod";

export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const withDescription = (jsonSchema: Record<string, unknown>) => {
    const description = schema.description;
    return description ? { ...jsonSchema, description } : jsonSchema;
  };

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, Record<string, unknown>> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodType);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    return withDescription({
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    });
  }

  if (schema instanceof z.ZodString) return withDescription({ type: "string" });
  if (schema instanceof z.ZodNumber) return withDescription({ type: "number" });
  if (schema instanceof z.ZodBoolean) return withDescription({ type: "boolean" });
  if (schema instanceof z.ZodArray) return withDescription({ type: "array", items: zodToJsonSchema(schema.element) });
  if (schema instanceof z.ZodTuple) {
    const items = schema.items.map((item: z.ZodType) => zodToJsonSchema(item));
    return withDescription({ type: "array", prefixItems: items, minItems: items.length, maxItems: items.length });
  }
  if (schema instanceof z.ZodRecord) {
    return withDescription({ type: "object", additionalProperties: zodToJsonSchema(schema.valueSchema) });
  }
  if (schema instanceof z.ZodUnknown || schema instanceof z.ZodAny) return withDescription({});
  if (schema instanceof z.ZodOptional) return zodToJsonSchema(schema.unwrap());
  if (schema instanceof z.ZodDefault) return zodToJsonSchema(schema.removeDefault() as z.ZodType);

  return withDescription({ type: "string" });
}
