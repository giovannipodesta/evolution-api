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

export const eventoConfigUbicacionSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    latitude: { type: 'number', description: 'Latitud GPS' },
    longitude: { type: 'number', description: 'Longitud GPS' },
    name: { type: 'string', description: 'Nombre del lugar' },
    address: { type: 'string', description: 'Dirección del lugar' },
    enabled: { type: 'boolean', description: 'Habilitar envío de ubicación' },
  },
  required: ['latitude', 'longitude'],
};

export const eventoEnvioProgramadoSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    telefono: { type: 'string', minLength: 1, description: 'Número de teléfono' },
    url: { type: 'string', minLength: 1, description: 'URL a enviar' },
    timestamp: { type: 'number', description: 'Timestamp Unix en milisegundos para el envío' },
  },
  required: ['telefono', 'url', 'timestamp'],
};

export const eventoEnvioBulkSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    envios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          telefono: { type: ['string', 'number'] },
          url: { type: 'string' },
          timestamp: { type: 'number' },
        },
        required: ['telefono', 'url', 'timestamp'],
      },
    },
  },
  required: ['envios'],
};
