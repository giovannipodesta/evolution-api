import { InstanceDto } from '@api/dto/instance.dto';

import { EventoRegistroDto, EventoSendQrDto } from '../dto/evento.dto';
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
}
