import { InstanceDto } from '@api/dto/instance.dto';

import {
  EventoConfigUbicacionDto,
  EventoEnvioBulkDto,
  EventoEnvioProgramadoDto,
  EventoRegistroDto,
  EventoSendQrDto,
} from '../dto/evento.dto';
import { EventoService } from '../services/evento.service';

export class EventoController {
  constructor(private readonly eventoService: EventoService) {}

  public async registro(instance: InstanceDto, data: EventoRegistroDto) {
    return this.eventoService.registro(instance, data);
  }

  public async sendQr(instance: InstanceDto, data: EventoSendQrDto) {
    return this.eventoService.sendQr(instance, data);
  }

  public async getStats(instance: InstanceDto) {
    return this.eventoService.getStats(instance);
  }

  public async getRegistros(instance: InstanceDto) {
    return this.eventoService.getRegistros(instance);
  }

  public async getPendientes(instance: InstanceDto) {
    return this.eventoService.getPendientes(instance);
  }

  public async handleWebhook(instance: InstanceDto, data: any) {
    return this.eventoService.handleWebhook(instance, data);
  }

  // Ubicación GPS
  public getUbicacion() {
    return this.eventoService.getUbicacion();
  }

  public async setUbicacion(data: EventoConfigUbicacionDto) {
    return this.eventoService.setUbicacion(data);
  }

  // Envíos programados
  public async programarEnvio(instance: InstanceDto, data: EventoEnvioProgramadoDto) {
    return this.eventoService.programarEnvio(instance, data);
  }

  public async programarEnviosBulk(instance: InstanceDto, data: EventoEnvioBulkDto) {
    return this.eventoService.programarEnviosBulk(instance, data);
  }

  public async getEnviosProgramados(instanceName?: string) {
    return this.eventoService.getEnviosProgramados(instanceName);
  }

  public async cancelarEnvio(telefono: string, timestamp: number) {
    return this.eventoService.cancelarEnvio(telefono, timestamp);
  }

  public async getHistorialEnvios(instanceName?: string, limite?: number) {
    return this.eventoService.getHistorialEnvios(instanceName, limite);
  }

  // Click tracking for scheduled messages
  public async handleClickTracking(envioId: string) {
    return this.eventoService.handleClickTracking(envioId);
  }
}
