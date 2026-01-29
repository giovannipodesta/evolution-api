export class EventoRegistroDto {
  telefono: string;
  name?: string;
}

export class EventoSendQrDto {
  telefono: string;
  codigo: string;
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
