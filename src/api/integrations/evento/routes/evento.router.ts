import { RouterBroker } from '@api/abstract/abstract.router';
import { InstanceDto } from '@api/dto/instance.dto';
import { HttpStatus } from '@api/routes/index.router';
import { eventoController } from '@api/server.module';
import { instanceSchema } from '@validate/instance.schema';
import { RequestHandler, Router } from 'express';

import { EventoRegistroDto, EventoSendQrDto } from '../dto/evento.dto';
import { eventoRegistroSchema, eventoSendQrSchema } from '../validate/evento.schema';

export class EventoRouter extends RouterBroker {
  constructor(...guards: RequestHandler[]) {
    super();
    this.router
      .post(this.routerPath('registro'), ...guards, async (req, res) => {
        const response = await this.dataValidate<EventoRegistroDto>({
          request: req,
          schema: eventoRegistroSchema,
          ClassRef: EventoRegistroDto,
          execute: (instance, data) => eventoController.registro(instance, data),
        });

        res.status(HttpStatus.CREATED).json(response);
      })
      .post(this.routerPath('send-qr'), ...guards, async (req, res) => {
        const response = await this.dataValidate<EventoSendQrDto>({
          request: req,
          schema: eventoSendQrSchema,
          ClassRef: EventoSendQrDto,
          execute: (instance, data) => eventoController.sendQr(instance, data),
        });

        res.status(HttpStatus.OK).json(response);
      })
      .get(this.routerPath('stats'), ...guards, async (req, res) => {
        const response = await this.dataValidate<InstanceDto>({
          request: req,
          schema: instanceSchema,
          ClassRef: InstanceDto,
          execute: (instance) => eventoController.getStats(instance),
        });

        res.status(HttpStatus.OK).json(response);
      })
      .get(this.routerPath('registros'), ...guards, async (req, res) => {
        const response = await this.dataValidate<InstanceDto>({
          request: req,
          schema: instanceSchema,
          ClassRef: InstanceDto,
          execute: (instance) => eventoController.getRegistros(instance),
        });

        res.status(HttpStatus.OK).json(response);
      })
      .get(this.routerPath('pendientes'), ...guards, async (req, res) => {
        const response = await this.dataValidate<InstanceDto>({
          request: req,
          schema: instanceSchema,
          ClassRef: InstanceDto,
          execute: (instance) => eventoController.getPendientes(instance),
        });

        res.status(HttpStatus.OK).json(response);
      })
      .post(this.routerPath('webhook', false), async (req, res) => {
        const instance = { instanceName: req.query.instanceName as string } as InstanceDto;
        const response = await eventoController.handleWebhook(instance, req.body);
        res.status(HttpStatus.OK).json(response);
      });
  }

  public readonly router: Router = Router();
}
