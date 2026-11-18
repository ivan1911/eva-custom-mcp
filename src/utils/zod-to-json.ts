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
      ...(schema._def.unknownKeys === "strict" ? { additionalProperties: false } : {}),
    });
  }

  if (schema instanceof z.ZodString) return withDescription({
    type: "string",
    ...(schema.minLength !== null ? { minLength: schema.minLength } : {}),
    ...(schema.maxLength !== null ? { maxLength: schema.maxLength } : {}),
  });
  if (schema instanceof z.ZodNumber) {
    const bounds: Record<string, number> = {};
    for (const check of schema._def.checks) {
      if (check.kind === "min") {
        const key = check.inclusive ? "minimum" : "exclusiveMinimum";
        bounds[key] = Math.max(bounds[key] ?? -Infinity, check.value);
      } else if (check.kind === "max") {
        const key = check.inclusive ? "maximum" : "exclusiveMaximum";
        bounds[key] = Math.min(bounds[key] ?? Infinity, check.value);
      }
    }
    return withDescription({ type: schema.isInt ? "integer" : "number", ...bounds });
  }
  if (schema instanceof z.ZodBoolean) return withDescription({ type: "boolean" });
  if (schema instanceof z.ZodEnum) return withDescription({ type: "string", enum: schema.options });
  if (schema instanceof z.ZodArray) return withDescription({ type: "array", items: zodToJsonSchema(schema.element) });
  if (schema instanceof z.ZodTuple) {
    const items = schema.items.map((item: z.ZodType) => zodToJsonSchema(item));
    return withDescription({ type: "array", prefixItems: items, minItems: items.length, maxItems: items.length });
  }
  if (schema instanceof z.ZodRecord) {
    return withDescription({ type: "object", additionalProperties: zodToJsonSchema(schema.valueSchema) });
  }
  if (schema instanceof z.ZodUnknown || schema instanceof z.ZodAny) return withDescription({});
  // Wrappers keep their own description (e.g. `.optional().describe(...)`) on top of the inner schema.
  if (schema instanceof z.ZodOptional) return withDescription(zodToJsonSchema(schema.unwrap()));
  if (schema instanceof z.ZodDefault) {
    return withDescription({
      ...zodToJsonSchema(schema.removeDefault() as z.ZodType),
      default: schema._def.defaultValue(),
    });
  }

  return withDescription({ type: "string" });
}
