import { JSONSchema7 } from 'json-schema';
import { v4 } from 'uuid';

export const eventoRegistroSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    telefono: { type: 'string', minLength: 1, description: 'El campo telefono es requerido' },
    name: { type: 'string', description: 'Nombre del registrado (opcional)' },
  },
  required: ['telefono'],
};

export const eventoSendQrSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    telefono: { type: 'string', minLength: 1, description: 'El campo telefono es requerido' },
    codigo: { type: 'string', minLength: 1, description: 'El campo codigo es requerido' },
  },
  required: ['telefono', 'codigo'],
};
