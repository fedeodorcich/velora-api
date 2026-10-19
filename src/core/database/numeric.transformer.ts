import type { ValueTransformer } from 'typeorm';

/**
 * PostgreSQL devuelve las columnas `numeric` como `string`.
 * Este transformer las expone como `number` en la entidad para poder operar con ellas.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | null): number | null => (value === null ? null : Number(value)),
};
