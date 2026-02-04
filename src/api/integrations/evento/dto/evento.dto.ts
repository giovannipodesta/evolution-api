export class EventoRegistroDto {
  telefono: string;
  name?: string;
  esReferido?: boolean;
  referidoPor?: string;
}

export class EventoSendQrDto {
  telefono: string;
  codigo: string;
  esInvitadoEspecial?: boolean;
  force?: boolean;
}

export class EventoWebhookDto {
  event: string;
  data: {
    status?: string;
    key?: {
      id?: string;
    };
  };
}

export class EventoStatsDto {
  totalRegistros: number;
  mensajesEnviados: number;
  mensajesRecibidos: number;
  mensajesLeidos: number;
  qrsEnviados: number;
  qrsLeidos: number;
  pendientesQr: number;
}

export class EventoConfigUbicacionDto {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  enabled?: boolean;
}

export class EventoEnvioProgramadoDto {
  telefono: string;
  url: string;
  timestamp: number; // Unix timestamp en milisegundos
}

export class EventoEnvioBulkItemDto {
  telefono: string | number;
  url: string;
  timestamp: number;
}

export class EventoEnvioBulkDto {
  envios: EventoEnvioBulkItemDto[];
}
