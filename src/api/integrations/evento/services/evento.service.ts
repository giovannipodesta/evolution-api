import { InstanceDto } from '@api/dto/instance.dto';
import { PrismaRepository } from '@api/repository/repository.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Logger } from '@config/logger.config';
import { BadRequestException, NotFoundException } from '@exceptions';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import sharp from 'sharp';

import { EventoRegistroDto, EventoSendQrDto, EventoStatsDto } from '../dto/evento.dto';

export class EventoService {
  private readonly logger = new Logger('EventoService');

  constructor(
    private readonly waMonitor: WAMonitoringService,
    private readonly prisma: PrismaRepository,
  ) {}

  private buildMensajeRegistro(name?: string): string {
    const nombreParte = name ? ` ${name}` : '';
    return `🎉 *¡Gracias${nombreParte} por registrarte!*

Muchas gracias por tu registro a nuestro evento donde mostraremos cómo estamos por cambiar la vida de los Ecuatorianos.

*Encuentra Fácil* dará un paso que, de aceptarse tu solicitud al evento, podrás contemplar.

⏳ Espera nuestro mensaje de confirmación.

_Este es un mensaje automático._`;
  }

  private validatePhone(phone: string): string | null {
    if (!phone) return null;
    let cleaned = phone.toString().replace(/\D/g, '');

    if (cleaned.startsWith('0')) {
      cleaned = '593' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('593')) {
      cleaned = '593' + cleaned;
    }

    if (cleaned.length !== 12) {
      return null;
    }

    return cleaned;
  }

  private async generateEventQR(codigo: string): Promise<Buffer> {
    const baseImagePath = path.join(process.cwd(), 'public', 'evento', 'QR3.jpeg');

    if (!fs.existsSync(baseImagePath)) {
      throw new NotFoundException(`Imagen base no encontrada: ${baseImagePath}`);
    }

    const qrSize = 520;

    const qrBuffer = await QRCode.toBuffer(codigo, {
      type: 'png',
      width: qrSize,
      margin: 1,
      color: {
        dark: '#FFFFFF',
        light: '#00000000',
      },
    });

    const baseImage = sharp(baseImagePath);
    const metadata = await baseImage.metadata();

    const x = Math.floor((metadata.width - qrSize) / 2);
    const y = 570;

    const finalImage = await baseImage
      .composite([
        {
          input: qrBuffer,
          top: y,
          left: x,
          blend: 'over',
        },
      ])
      .jpeg({ quality: 95 })
      .toBuffer();

    return finalImage;
  }

  public async registro(instance: InstanceDto, data: EventoRegistroDto) {
    const phoneNumber = this.validatePhone(data.telefono);
    if (!phoneNumber) {
      throw new BadRequestException('Número de teléfono inválido. Debe ser un número ecuatoriano válido.');
    }

    const waInstance = this.waMonitor.waInstances[instance.instanceName];
    if (!waInstance) {
      throw new NotFoundException(`Instance ${instance.instanceName} not found`);
    }

    // Verificar que la instancia esté conectada
    const connectionState = waInstance.connectionStatus?.state;
    if (connectionState !== 'open') {
      throw new BadRequestException(
        `La instancia ${instance.instanceName} no está conectada. Estado actual: ${connectionState || 'desconocido'}`,
      );
    }

    const instanceData = await this.prisma.instance.findUnique({
      where: { name: instance.instanceName },
    });

    if (!instanceData) {
      throw new NotFoundException(`Instance ${instance.instanceName} not found in database`);
    }

    const existing = await (this.prisma as any).eventoRegistro.findFirst({
      where: {
        telefono: phoneNumber,
        instanceId: instanceData.id,
      },
    });

    if (existing && existing.mensajeEnviado) {
      return {
        success: true,
        message: 'Número ya registrado previamente',
        yaRegistrado: true,
        telefono: phoneNumber,
      };
    }

    const result = await waInstance.textMessage({
      number: phoneNumber,
      text: this.buildMensajeRegistro(data.name),
    });

    if (!result || result.error) {
      this.logger.error('Error enviando mensaje de registro');
      throw new BadRequestException('Error al enviar mensaje');
    }

    const messageKey = result.key?.id || null;

    // Usar create o update según si existe el registro
    if (existing) {
      await (this.prisma as any).eventoRegistro.update({
        where: { id: existing.id },
        data: {
          mensajeEnviado: true,
          mensajeKey: messageKey,
        },
      });
    } else {
      await (this.prisma as any).eventoRegistro.create({
        data: {
          telefono: phoneNumber,
          instanceId: instanceData.id,
          mensajeEnviado: true,
          mensajeRecibido: true,
          mensajeKey: messageKey,
        },
      });
    }

    return {
      success: true,
      message: 'Mensaje de registro enviado',
      telefono: phoneNumber,
    };
  }

  public async sendQr(instance: InstanceDto, data: EventoSendQrDto) {
    const phoneNumber = this.validatePhone(data.telefono);
    if (!phoneNumber) {
      throw new BadRequestException('Número de teléfono inválido');
    }

    const waInstance = this.waMonitor.waInstances[instance.instanceName];
    if (!waInstance) {
      throw new NotFoundException(`Instance ${instance.instanceName} not found`);
    }

    const instanceData = await this.prisma.instance.findUnique({
      where: { name: instance.instanceName },
    });

    if (!instanceData) {
      throw new NotFoundException(`Instance ${instance.instanceName} not found in database`);
    }

    const registro = await this.prisma.eventoRegistro.findUnique({
      where: {
        telefono_instanceId: {
          telefono: phoneNumber,
          instanceId: instanceData.id,
        },
      },
    });

    if (!registro) {
      throw new BadRequestException('Este número no está registrado. Primero debe registrarse.');
    }

    if (registro.qrEnviado) {
      return {
        success: true,
        message: 'QR ya fue enviado previamente',
        yaEnviado: true,
        codigo: registro.qrCodigo,
      };
    }

    const imageBuffer = await this.generateEventQR(data.codigo);
    const imageBase64 = imageBuffer.toString('base64');

    const caption = `Fuiste elegido!\n\nMuchas gracias por tu registro.\n\nPresenta este codigo en la entrada.`;

    const result = await waInstance.mediaMessage({
      number: phoneNumber,
      mediatype: 'image',
      media: imageBase64,
      caption: caption,
    });

    if (!result || result.error) {
      this.logger.error('Error enviando QR');
      throw new BadRequestException('Error al enviar QR');
    }

    const qrKey = result.key?.id || null;

    await this.prisma.eventoRegistro.update({
      where: {
        telefono_instanceId: {
          telefono: phoneNumber,
          instanceId: instanceData.id,
        },
      },
      data: {
        qrEnviado: true,
        qrCodigo: data.codigo,
        qrKey: qrKey,
      },
    });

    return {
      success: true,
      message: 'QR de acceso enviado',
      telefono: phoneNumber,
      codigo: data.codigo,
    };
  }

  public async getStats(instance: InstanceDto): Promise<{ success: boolean; stats: EventoStatsDto }> {
    const instanceData = await this.prisma.instance.findUnique({
      where: { name: instance.instanceName },
    });

    if (!instanceData) {
      throw new NotFoundException(`Instance ${instance.instanceName} not found`);
    }

    const registros = await this.prisma.eventoRegistro.findMany({
      where: { instanceId: instanceData.id },
    });

    const stats: EventoStatsDto = {
      totalRegistros: registros.length,
      mensajesEnviados: registros.filter((r) => r.mensajeEnviado).length,
      mensajesRecibidos: registros.filter((r) => r.mensajeRecibido).length,
      mensajesLeidos: registros.filter((r) => r.mensajeLeido).length,
      qrsEnviados: registros.filter((r) => r.qrEnviado).length,
      qrsLeidos: registros.filter((r) => r.qrLeido).length,
      pendientesQr: registros.filter((r) => !r.qrEnviado).length,
    };

    return { success: true, stats };
  }

  public async getRegistros(instance: InstanceDto) {
    const instanceData = await this.prisma.instance.findUnique({
      where: { name: instance.instanceName },
    });

    if (!instanceData) {
      throw new NotFoundException(`Instance ${instance.instanceName} not found`);
    }

    const registros = await this.prisma.eventoRegistro.findMany({
      where: { instanceId: instanceData.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      total: registros.length,
      registros,
    };
  }

  public async getPendientes(instance: InstanceDto) {
    const instanceData = await this.prisma.instance.findUnique({
      where: { name: instance.instanceName },
    });

    if (!instanceData) {
      throw new NotFoundException(`Instance ${instance.instanceName} not found`);
    }

    const pendientes = await this.prisma.eventoRegistro.findMany({
      where: {
        instanceId: instanceData.id,
        qrEnviado: false,
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      success: true,
      total: pendientes.length,
      pendientes,
    };
  }

  public async handleWebhook(instance: InstanceDto, data: any) {
    const instanceData = await this.prisma.instance.findUnique({
      where: { name: instance.instanceName },
    });

    if (!instanceData) {
      return { success: true };
    }

    if (data.event === 'messages.update' || data.event === 'message.read') {
      const eventData = data.data;

      if (eventData.status === 'READ' || eventData.status === 4) {
        const messageKey = eventData.key?.id;

        if (messageKey) {
          this.logger.log(`Mensaje leído detectado: ${messageKey}`);

          try {
            await this.prisma.eventoRegistro.updateMany({
              where: {
                instanceId: instanceData.id,
                mensajeKey: messageKey,
              },
              data: { mensajeLeido: true },
            });
          } catch (error) {
            this.logger.error(`Error actualizando mensaje leído: ${error}`);
          }

          try {
            await this.prisma.eventoRegistro.updateMany({
              where: {
                instanceId: instanceData.id,
                qrKey: messageKey,
              },
              data: { qrLeido: true },
            });
          } catch {
            // Silencioso, puede que no sea un QR
          }
        }
      }
    }

    return { success: true };
  }
}
