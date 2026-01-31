import { RouterBroker } from '@api/abstract/abstract.router';
import { InstanceDto } from '@api/dto/instance.dto';
import { HttpStatus } from '@api/routes/index.router';
import { eventoController } from '@api/server.module';
import { instanceSchema } from '@validate/instance.schema';
import { RequestHandler, Router } from 'express';

import { EventoEnvioBulkDto, EventoEnvioProgramadoDto, EventoRegistroDto, EventoSendQrDto } from '../dto/evento.dto';
import {
  eventoEnvioBulkSchema,
  eventoEnvioProgramadoSchema,
  eventoRegistroSchema,
  eventoSendQrSchema,
} from '../validate/evento.schema';

export class EventoRouter extends RouterBroker {
  constructor(authOnly: RequestHandler, ...guards: RequestHandler[]) {
    super();
    this.router
      // Rutas sin instanceName (solo auth)
      .get('/ubicacion', authOnly, async (req, res) => {
        const response = eventoController.getUbicacion();
        res.status(HttpStatus.OK).json(response);
      })
      .post('/ubicacion', authOnly, async (req, res) => {
        const response = await eventoController.setUbicacion(req.body);
        res.status(HttpStatus.OK).json(response);
      })
      .get('/programados', authOnly, async (req, res) => {
        const instanceName = req.query.instanceName as string | undefined;
        const response = await eventoController.getEnviosProgramados(instanceName);
        res.status(HttpStatus.OK).json(response);
      })
      .get('/historial', authOnly, async (req, res) => {
        const instanceName = req.query.instanceName as string | undefined;
        const limite = req.query.limite ? Number(req.query.limite) : undefined;
        const response = await eventoController.getHistorialEnvios(instanceName, limite);
        res.status(HttpStatus.OK).json(response);
      })
      .delete('/programar', authOnly, async (req, res) => {
        const { telefono, timestamp } = req.query;
        const response = await eventoController.cancelarEnvio(telefono as string, Number(timestamp));
        res.status(HttpStatus.OK).json(response);
      })
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
      })
      // Endpoints de envío programado (con instanceName)
      .post(this.routerPath('programar'), ...guards, async (req, res) => {
        const response = await this.dataValidate<EventoEnvioProgramadoDto>({
          request: req,
          schema: eventoEnvioProgramadoSchema,
          ClassRef: EventoEnvioProgramadoDto,
          execute: (instance, data) => eventoController.programarEnvio(instance, data),
        });
        res.status(HttpStatus.CREATED).json(response);
      })
      .post(this.routerPath('programar-bulk'), ...guards, async (req, res) => {
        const response = await this.dataValidate<EventoEnvioBulkDto>({
          request: req,
          schema: eventoEnvioBulkSchema,
          ClassRef: EventoEnvioBulkDto,
          execute: (instance, data) => eventoController.programarEnviosBulk(instance, data),
        });
        res.status(HttpStatus.CREATED).json(response);
      });
  }

  public readonly router: Router = Router();
}
