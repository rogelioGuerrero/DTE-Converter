import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { ErrorObject } from 'ajv';
import { DTE_SCHEMA } from './schema';
import type { ErrorValidacionMH } from './types';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validate = ajv.compile(DTE_SCHEMA);

export const validateDteSchema = (dte: unknown): ErrorValidacionMH[] => {
  const ok = validate(dte);
  if (ok) return [];

  return ((validate.errors || []) as ErrorObject[]).map((e: ErrorObject, idx: number) => {
    const campo = (e.instancePath || e.schemaPath || '').replace(/^\//, '').replace(/\//g, '.');
    return {
      codigo: `SCHEMA-${String(idx + 1).padStart(4, '0')}`,
      campo: campo || undefined,
      descripcion: e.message || 'Error de esquema',
      severidad: 'ERROR',
    };
  });
};
