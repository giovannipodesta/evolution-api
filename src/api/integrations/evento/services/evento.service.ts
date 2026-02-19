import { InstanceDto } from '@api/dto/instance.dto';
import { PrismaRepository } from '@api/repository/repository.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Logger } from '@config/logger.config';
import { BadRequestException, NotFoundException } from '@exceptions';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import sharp from 'sharp';

import {
  EventoConfigUbicacionDto,
  EventoEnvioBulkDto,
  EventoEnvioProgramadoDto,
  EventoRegistroDto,
  EventoSendQrDto,
  EventoStatsDto,
} from '../dto/evento.dto';

export class EventoService {
  private readonly logger = new Logger('EventoService');

  // Configuración de ubicación (en memoria, fácilmente modificable)
  private ubicacionConfig: EventoConfigUbicacionDto = {
    latitude: -2.1438713,
    longitude: -79.8878557,
    name: 'Evento Encuentra Fácil',
    address: 'Guayaquil, Ecuador',
    enabled: true,
  };

  // Cola de timeouts en memoria (solo para gestionar los setTimeout activos)
  private enviosTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private inicializado = false;

  constructor(
    private readonly waMonitor: WAMonitoringService,
    private readonly prisma: PrismaRepository,
  ) {
    // Inicializar envíos pendientes de la DB al crear el servicio
    this.inicializarEnviosPendientes();
  }

  // Cargar envíos pendientes de la base de datos al iniciar
  private async inicializarEnviosPendientes() {
    if (this.inicializado) return;
    this.inicializado = true;

    try {
      this.logger.log('📋 Cargando envíos programados pendientes de la base de datos...');

      const enviosPendientes = await this.prisma.eventoEnvioProgramado.findMany({
        where: {
          estado: 'pendiente',
        },
        include: {
          Instance: true,
        },
      });

      this.logger.log(`📋 Encontrados ${enviosPendientes.length} envíos pendientes`);

      for (const envio of enviosPendientes) {
        const ahora = Date.now();
        const timestampEnvio = Number(envio.timestampEnvio);
        const delay = timestampEnvio - ahora;

        if (delay <= 0) {
          // El timestamp ya pasó, ejecutar inmediatamente
          this.logger.warn(`⚠️ Envío ${envio.id} tiene timestamp pasado, ejecutando ahora...`);
          this.ejecutarEnvio(envio.id, envio.Instance.name);
        } else {
          // Programar el envío
          this.logger.log(`⏰ Reprogramando envío ${envio.id} para ${new Date(timestampEnvio).toISOString()}`);
          this.programarTimeout(envio.id, envio.Instance.name, delay);
        }
      }

      this.logger.log('✅ Envíos pendientes cargados correctamente');
    } catch (error) {
      this.logger.error(`❌ Error cargando envíos pendientes: ${error}`);
    }
  }

  // Programar un timeout para un envío específico
  private programarTimeout(envioId: string, instanceName: string, delay: number) {
    // Cancelar timeout existente si hay uno
    if (this.enviosTimeouts.has(envioId)) {
      clearTimeout(this.enviosTimeouts.get(envioId));
    }

    const timeout = setTimeout(() => {
      this.ejecutarEnvio(envioId, instanceName);
    }, delay);

    this.enviosTimeouts.set(envioId, timeout);
  }

  // Ejecutar un envío programado
  private async ejecutarEnvio(envioId: string, instanceName: string) {
    this.logger.log(`🚀 Ejecutando envío programado ${envioId}...`);

    try {
      // Marcar como procesando
      const envio = await this.prisma.eventoEnvioProgramado.update({
        where: { id: envioId },
        data: {
          estado: 'procesando',
          intentos: { increment: 1 },
        },
      });

      if (!envio) {
        this.logger.error(`❌ Envío ${envioId} no encontrado en DB`);
        return;
      }

      const waInstance = this.waMonitor.waInstances[instanceName];
      if (!waInstance) {
        throw new Error(`Instancia ${instanceName} no disponible`);
      }

      // Verificar estado de conexión
      const connectionState = waInstance.connectionStatus?.state;
      if (connectionState !== 'open') {
        throw new Error(`Instancia ${instanceName} no está conectada (estado: ${connectionState})`);
      }

      this.logger.log(`📝 Enviando presencia 'escribiendo' a ${envio.telefono}...`);

      // Simular "escribiendo" antes de enviar (anti-spam)
      await waInstance.sendPresence({
        number: envio.telefono,
        delay: 3000,
        presence: 'composing',
      });

      this.logger.log(`📤 Enviando mensaje a ${envio.telefono}: ${envio.url}`);

      // Construir tracking URL
      const trackingUrl = `${process.env.SERVER_URL || 'http://localhost:8080'}/evento/click/${envio.id}`;
      this.logger.log(`🔗 Tracking URL generada: ${trackingUrl}`);

      // Enviar el mensaje con la URL de tracking en lugar de la original
      const result = await waInstance.textMessage({
        number: envio.telefono,
        text: trackingUrl, // Usar tracking URL
        delay: 1000,
      });

      // Marcar como enviado
      await this.prisma.eventoEnvioProgramado.update({
        where: { id: envioId },
        data: {
          estado: 'enviado',
          enviadoAt: new Date(),
          mensajeKey: result?.key?.id || null,
        },
      });

      this.logger.log(`✅ Envío ${envioId} completado exitosamente a ${envio.telefono}`);

      // Limpiar timeout del mapa
      this.enviosTimeouts.delete(envioId);
    } catch (error) {
      // Mejorar serialización del error
      let errorMsg = 'Error desconocido';

      if (error instanceof Error) {
        errorMsg = error.message;
        // Si hay stack trace, incluirlo
        if (error.stack) {
          this.logger.error(`Stack trace: ${error.stack}`);
        }
      } else if (typeof error === 'object' && error !== null) {
        // Intentar serializar objetos de error complejos
        try {
          errorMsg = JSON.stringify(error, Object.getOwnPropertyNames(error));
        } catch {
          errorMsg = String(error);
        }
      } else {
        errorMsg = String(error);
      }

      this.logger.error(`❌ Error en envío ${envioId}: ${errorMsg}`);

      // Marcar como error
      await this.prisma.eventoEnvioProgramado.update({
        where: { id: envioId },
        data: {
          estado: 'error',
          ultimoError: errorMsg.substring(0, 500), // Limitar a 500 caracteres
        },
      });

      // Limpiar timeout del mapa
      this.enviosTimeouts.delete(envioId);
    }
  }

  private buildMensajeRegistro(name?: string, esReferido: boolean = false): string {
    const nombreParte = name ? ` ${name}` : '';

    if (esReferido) {
      return `Gracias por registrarte${nombreParte}. Fuiste referido por un amigo. Tu invitación está pendiente de aprobación.`;
    }

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

  private async generateEventQR(codigo: string, esInvitadoEspecial: boolean = false): Promise<Buffer> {
    const imageName = esInvitadoEspecial ? 'QR4.jpeg' : 'QR3.jpeg';
    const baseImagePath = path.join(process.cwd(), 'public', 'evento', imageName);

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
      text: this.buildMensajeRegistro(data.name, data.esReferido),
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

  // Configurar ubicación GPS
  public async setUbicacion(data: EventoConfigUbicacionDto) {
    this.ubicacionConfig = {
      ...this.ubicacionConfig,
      ...data,
    };
    this.logger.log(`Ubicación configurada: ${JSON.stringify(this.ubicacionConfig)}`);
    return {
      success: true,
      message: 'Ubicación configurada',
      config: this.ubicacionConfig,
    };
  }

  // Obtener configuración de ubicación actual
  public getUbicacion() {
    return {
      success: true,
      config: this.ubicacionConfig,
    };
  }

  // Programar envío de mensaje con URL en un timestamp específico (persistente en DB)
  public async programarEnvio(instance: InstanceDto, data: EventoEnvioProgramadoDto) {
    const phoneNumber = this.validatePhone(data.telefono);
    if (!phoneNumber) {
      this.logger.error(`❌ Número de teléfono inválido: ${data.telefono}`);
      throw new BadRequestException('Número de teléfono inválido');
    }

    this.logger.log(
      `📥 Recibida solicitud de envío programado: telefono=${phoneNumber}, url=${data.url}, timestamp=${data.timestamp}`,
    );

    const waInstance = this.waMonitor.waInstances[instance.instanceName];
    if (!waInstance) {
      this.logger.error(`❌ Instancia ${instance.instanceName} no encontrada`);
      throw new NotFoundException(`Instance ${instance.instanceName} not found`);
    }

    const instanceData = await this.prisma.instance.findUnique({
      where: { name: instance.instanceName },
    });

    if (!instanceData) {
      this.logger.error(`❌ Instancia ${instance.instanceName} no encontrada en DB`);
      throw new NotFoundException(`Instance ${instance.instanceName} not found in database`);
    }

    const ahora = Date.now();
    const delay = data.timestamp - ahora;

    if (delay < 0) {
      this.logger.error(`❌ Timestamp en el pasado: ${data.timestamp} (ahora: ${ahora})`);
      throw new BadRequestException('El timestamp debe ser en el futuro');
    }

    // Verificar si ya existe un envío para este número y timestamp
    const existente = await this.prisma.eventoEnvioProgramado.findUnique({
      where: {
        telefono_timestampEnvio_instanceId: {
          telefono: phoneNumber,
          timestampEnvio: BigInt(data.timestamp),
          instanceId: instanceData.id,
        },
      },
    });

    let envioId: string;

    if (existente) {
      // Actualizar envío existente
      this.logger.log(`📝 Actualizando envío existente ${existente.id}`);
      await this.prisma.eventoEnvioProgramado.update({
        where: { id: existente.id },
        data: {
          url: data.url,
          estado: 'pendiente',
          intentos: 0,
          ultimoError: null,
        },
      });
      envioId = existente.id;

      // Cancelar timeout anterior si existe
      if (this.enviosTimeouts.has(envioId)) {
        clearTimeout(this.enviosTimeouts.get(envioId));
      }
    } else {
      // Crear nuevo envío
      this.logger.log(`➕ Creando nuevo envío programado para ${phoneNumber}`);
      const nuevoEnvio = await this.prisma.eventoEnvioProgramado.create({
        data: {
          telefono: phoneNumber,
          url: data.url,
          timestampEnvio: BigInt(data.timestamp),
          estado: 'pendiente',
          instanceId: instanceData.id,
        },
      });
      envioId = nuevoEnvio.id;
    }

    // Programar el timeout
    this.programarTimeout(envioId, instance.instanceName, delay);

    this.logger.log(
      `✅ Envío ${envioId} programado para ${new Date(data.timestamp).toISOString()} (delay: ${delay}ms)`,
    );

    return {
      success: true,
      message: 'Envío programado',
      envioId,
      telefono: phoneNumber,
      programadoPara: new Date(data.timestamp).toISOString(),
      delayMs: delay,
    };
  }

  // Programar envíos en bulk con espaciado anti-spam
  public async programarEnviosBulk(instance: InstanceDto, data: EventoEnvioBulkDto) {
    const resultados = [];
    const MIN_SPACING_MS = 5000; // Mínimo 5 segundos entre envíos

    // Ordenar por timestamp
    const enviosOrdenados = [...data.envios].sort((a, b) => a.timestamp - b.timestamp);

    let ultimoTimestamp = 0;

    for (const envio of enviosOrdenados) {
      // Convertir telefono a string si viene como número
      const telefonoStr = typeof envio.telefono === 'number' ? envio.telefono.toString() : envio.telefono;

      // Asegurar espaciado mínimo entre envíos para evitar spam
      let timestampAjustado = envio.timestamp;
      if (ultimoTimestamp > 0 && envio.timestamp - ultimoTimestamp < MIN_SPACING_MS) {
        timestampAjustado = ultimoTimestamp + MIN_SPACING_MS;
      }

      try {
        const resultado = await this.programarEnvio(instance, {
          telefono: telefonoStr,
          url: envio.url,
          timestamp: timestampAjustado,
        });
        resultados.push(resultado);
        ultimoTimestamp = timestampAjustado;
      } catch (error) {
        resultados.push({
          success: false,
          telefono: telefonoStr,
          error: error.message,
        });
      }
    }

    return {
      success: true,
      message: `${resultados.filter((r) => r.success).length}/${data.envios.length} envíos programados`,
      resultados,
    };
  }

  // Cancelar envío programado (persistente en DB)
  public async cancelarEnvio(telefono: string, timestamp: number) {
    const phoneNumber = this.validatePhone(telefono);
    if (!phoneNumber) {
      throw new BadRequestException('Número de teléfono inválido');
    }

    this.logger.log(`🚫 Solicitud de cancelación: telefono=${phoneNumber}, timestamp=${timestamp}`);

    // Buscar envío en la DB
    const envio = await this.prisma.eventoEnvioProgramado.findFirst({
      where: {
        telefono: phoneNumber,
        timestampEnvio: BigInt(timestamp),
        estado: 'pendiente',
      },
    });

    if (!envio) {
      this.logger.warn(`⚠️ No se encontró envío pendiente para ${phoneNumber} con timestamp ${timestamp}`);
      return {
        success: false,
        message: 'No se encontró el envío programado',
        telefono: phoneNumber,
      };
    }

    // Cancelar timeout si existe
    if (this.enviosTimeouts.has(envio.id)) {
      clearTimeout(this.enviosTimeouts.get(envio.id));
      this.enviosTimeouts.delete(envio.id);
    }

    // Marcar como cancelado en DB
    await this.prisma.eventoEnvioProgramado.update({
      where: { id: envio.id },
      data: { estado: 'cancelado' },
    });

    this.logger.log(`✅ Envío ${envio.id} cancelado exitosamente`);

    return {
      success: true,
      message: 'Envío cancelado',
      envioId: envio.id,
      telefono: phoneNumber,
    };
  }

  // Listar envíos programados pendientes (desde DB)
  public async getEnviosProgramados(instanceName?: string) {
    this.logger.log(`📋 Consultando envíos programados pendientes...`);

    const where: any = {
      estado: { in: ['pendiente', 'procesando'] },
    };

    if (instanceName) {
      const instanceData = await this.prisma.instance.findUnique({
        where: { name: instanceName },
      });
      if (instanceData) {
        where.instanceId = instanceData.id;
      }
    }

    const envios = await this.prisma.eventoEnvioProgramado.findMany({
      where,
      orderBy: { timestampEnvio: 'asc' },
      include: { Instance: { select: { name: true } } },
    });

    this.logger.log(`📋 Encontrados ${envios.length} envíos pendientes`);

    return {
      success: true,
      total: envios.length,
      envios: envios.map((e) => ({
        id: e.id,
        telefono: e.telefono,
        url: e.url,
        timestampEnvio: Number(e.timestampEnvio),
        programadoPara: new Date(Number(e.timestampEnvio)).toISOString(),
        estado: e.estado,
        intentos: e.intentos,
        ultimoError: e.ultimoError,
        instanceName: e.Instance.name,
        createdAt: e.createdAt,
      })),
    };
  }

  // Obtener historial de envíos (todos los estados)
  public async getHistorialEnvios(instanceName?: string, limite = 50) {
    this.logger.log(`📜 Consultando historial de envíos...`);

    const where: any = {};

    if (instanceName) {
      const instanceData = await this.prisma.instance.findUnique({
        where: { name: instanceName },
      });
      if (instanceData) {
        where.instanceId = instanceData.id;
      }
    }

    const envios = await this.prisma.eventoEnvioProgramado.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limite,
      include: { Instance: { select: { name: true } } },
    });

    const stats = {
      pendientes: envios.filter((e) => e.estado === 'pendiente').length,
      procesando: envios.filter((e) => e.estado === 'procesando').length,
      enviados: envios.filter((e) => e.estado === 'enviado').length,
      errores: envios.filter((e) => e.estado === 'error').length,
      cancelados: envios.filter((e) => e.estado === 'cancelado').length,
    };

    return {
      success: true,
      total: envios.length,
      stats,
      envios: envios.map((e) => ({
        id: e.id,
        telefono: e.telefono,
        url: e.url,
        timestampEnvio: Number(e.timestampEnvio),
        programadoPara: new Date(Number(e.timestampEnvio)).toISOString(),
        estado: e.estado,
        intentos: e.intentos,
        ultimoError: e.ultimoError,
        enviadoAt: e.enviadoAt,
        mensajeKey: e.mensajeKey,
        instanceName: e.Instance.name,
        createdAt: e.createdAt,
      })),
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

    let registro = await this.prisma.eventoRegistro.findUnique({
      where: {
        telefono_instanceId: {
          telefono: phoneNumber,
          instanceId: instanceData.id,
        },
      },
    });

    // Si no existe registro y es invitado especial, crear uno automáticamente
    if (!registro) {
      if (data.esInvitadoEspecial) {
        this.logger.log(`📝 Creando registro automático para invitado especial: ${phoneNumber}`);
        registro = await this.prisma.eventoRegistro.create({
          data: {
            telefono: phoneNumber,
            instanceId: instanceData.id,
            mensajeEnviado: false,
            mensajeRecibido: false,
          },
        });
      } else {
        throw new BadRequestException('Este número no está registrado. Primero debe registrarse.');
      }
    }

    const isDev = process.env.NODE_ENV !== 'PROD';
    if (registro.qrEnviado && (!data.force || !isDev)) {
      // QR ya enviado: si falta la imagen de ubicación, enviarla ahora
      if (!registro.locationEnviada) {
        setTimeout(async () => {
          try {
            await this.enviarImagenUbicacion(waInstance, phoneNumber);
            await this.prisma.eventoRegistro.update({
              where: { telefono_instanceId: { telefono: phoneNumber, instanceId: instanceData.id } },
              data: { locationEnviada: true },
            });
          } catch (error) {
            this.logger.error(`Error enviando imagen de ubicación a ${phoneNumber}: ${error}`);
          }
        }, 1500);
      }
      return {
        success: true,
        message: 'QR ya fue enviado previamente',
        yaEnviado: true,
        codigo: registro.qrCodigo,
      };
    }

    const imageBuffer = await this.generateEventQR(data.codigo, data.esInvitadoEspecial);
    const imageBase64 = imageBuffer.toString('base64');

    let caption = `Fuiste elegido!\n\nMuchas gracias por tu registro.\n\nPresenta este codigo en la entrada.`;

    if (data.esInvitadoEspecial) {
      caption = `¡Hola! Aquí tienes la entrada para nuestro evento.\n\nEs un honor contar con tu presencia.`;
    }

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

    // Enviar imagen de ubicación 1.5 segundos después del QR
    setTimeout(async () => {
      try {
        await this.enviarImagenUbicacion(waInstance, phoneNumber);
        await this.prisma.eventoRegistro.update({
          where: { telefono_instanceId: { telefono: phoneNumber, instanceId: instanceData.id } },
          data: { locationEnviada: true },
        });
      } catch (error) {
        this.logger.error(`Error enviando imagen de ubicación a ${phoneNumber}: ${error}`);
      }
    }, 1500);

    return {
      success: true,
      message: 'QR de acceso enviado',
      telefono: phoneNumber,
      codigo: data.codigo,
    };
  }

  private async enviarImagenUbicacion(waInstance: any, phoneNumber: string) {
    const locationImagePath = path.join(process.cwd(), 'public', 'evento', 'location.jpeg');
    if (!fs.existsSync(locationImagePath)) {
      this.logger.warn(`⚠️ Imagen de ubicación no encontrada: ${locationImagePath}`);
      return;
    }
    const imageBase64 = fs.readFileSync(locationImagePath).toString('base64');
    await waInstance.mediaMessage({
      number: phoneNumber,
      mediatype: 'image',
      media: imageBase64,
      caption: '📍 Cómo llegar al evento',
      delay: 1500,
    });
    this.logger.log(`📍 Imagen de ubicación enviada a ${phoneNumber}`);
  }

  public async enviarUbicacionMasivo(instance: InstanceDto) {
    const waInstance = this.waMonitor.waInstances[instance.instanceName];
    if (!waInstance) {
      throw new NotFoundException(`Instance ${instance.instanceName} not found`);
    }

    const connectionState = waInstance.connectionStatus?.state;
    if (connectionState !== 'open') {
      throw new BadRequestException(`Instancia ${instance.instanceName} no conectada (estado: ${connectionState})`);
    }

    const instanceData = await this.prisma.instance.findUnique({
      where: { name: instance.instanceName },
    });

    if (!instanceData) {
      throw new NotFoundException(`Instance ${instance.instanceName} not found in database`);
    }

    // Obtener todos los usuarios aceptados (qrEnviado = true)
    const aceptados = await this.prisma.eventoRegistro.findMany({
      where: {
        instanceId: instanceData.id,
        qrEnviado: true,
      },
    });

    this.logger.log(`📍 Enviando ubicación masiva a ${aceptados.length} usuarios aceptados...`);

    const resultados = { enviados: 0, errores: 0, detalles: [] as any[] };

    for (const registro of aceptados) {
      try {
        this.logger.log(
          `📍 Enviando ubicación a ${registro.telefono} (${resultados.enviados + 1}/${aceptados.length})`,
        );

        await this.enviarImagenUbicacion(waInstance, registro.telefono);
        await this.prisma.eventoRegistro.update({
          where: { id: registro.id },
          data: { locationEnviada: true },
        });

        resultados.enviados++;
        resultados.detalles.push({ telefono: registro.telefono, estado: 'enviado' });

        // Anti-spam: esperar 5 segundos entre cada envío
        if (resultados.enviados < aceptados.length) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(`❌ Error enviando ubicación a ${registro.telefono}: ${errorMsg}`);
        resultados.errores++;
        resultados.detalles.push({ telefono: registro.telefono, estado: 'error', error: errorMsg });
      }
    }

    this.logger.log(`📍 Envío masivo completado: ${resultados.enviados} enviados, ${resultados.errores} errores`);

    return {
      success: true,
      total: aceptados.length,
      enviados: resultados.enviados,
      errores: resultados.errores,
      detalles: resultados.detalles,
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

  /**
   * Handle click tracking for scheduled messages.
   * Records the click timestamp and returns the original URL for redirection.
   * Also notifies serverRegister via webhook.
   */
  public async handleClickTracking(envioId: string): Promise<{ success: boolean; url?: string; error?: string }> {
    this.logger.log(`🔗 Click tracking: ${envioId}`);

    try {
      const envio = await this.prisma.eventoEnvioProgramado.findUnique({
        where: { id: envioId },
        include: { Instance: true },
      });

      if (!envio) {
        this.logger.warn(`⚠️ Envío ${envioId} no encontrado`);
        return { success: false, error: 'Envío no encontrado' };
      }

      // Update clickedAt timestamp
      await this.prisma.eventoEnvioProgramado.update({
        where: { id: envioId },
        data: { clickedAt: new Date() },
      });

      this.logger.log(`✅ Click registrado para ${envio.telefono} en ${envioId}`);

      // Notify serverRegister via webhook (fire and forget)
      this.notifyServerRegister(envioId, envio.telefono).catch((error) => {
        this.logger.error(`❌ Error notificando a serverRegister: ${error}`);
      });

      return { success: true, url: envio.url };
    } catch (error) {
      this.logger.error(`❌ Error en click tracking: ${error}`);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Notify serverRegister about a link click (fire and forget)
   * Also attempts to fetch and include the contact's profile picture URL
   */
  private async notifyServerRegister(envioId: string, telefono: string): Promise<void> {
    const serverRegisterUrl = process.env.SERVER_REGISTER_URL;
    if (!serverRegisterUrl) {
      this.logger.warn('⚠️ SERVER_REGISTER_URL no configurado, omitiendo notificación');
      return;
    }

    let profilePictureUrl: string | null = null;

    // Intentar obtener la foto de perfil del contacto
    try {
      const envio = await this.prisma.eventoEnvioProgramado.findUnique({
        where: { id: envioId },
        include: { Instance: true },
      });

      if (envio?.Instance?.name) {
        profilePictureUrl = await this.fetchProfilePicture(envio.Instance.name, telefono);
      }
    } catch (error) {
      // No dejar que un error en la foto bloquee la notificación principal
      this.logger.warn(`⚠️ No se pudo obtener foto de perfil para ${telefono}: ${error.message}`);
    }

    try {
      const axios = await import('axios');
      const payload = {
        envioId,
        telefono,
        timestamp: Date.now(),
        ...(profilePictureUrl && { profilePictureUrl }), // Solo incluir si existe
      };

      await axios.default.post(`${serverRegisterUrl}/api/webhook/click`, payload);

      const logMsg = profilePictureUrl
        ? `📤 Webhook enviado a serverRegister para ${envioId} (con foto de perfil)`
        : `📤 Webhook enviado a serverRegister para ${envioId}`;
      this.logger.log(logMsg);
    } catch (error) {
      this.logger.error(`❌ Error enviando webhook a serverRegister: ${error}`);
    }
  }

  /**
   * Fetch profile picture URL from Evolution API
   * Uses the native /chat/fetchProfilePictureUrl endpoint
   */
  private async fetchProfilePicture(instanceName: string, telefono: string): Promise<string | null> {
    try {
      const waInstance = this.waMonitor.waInstances[instanceName];
      if (!waInstance) {
        this.logger.warn(`⚠️ Instancia ${instanceName} no encontrada para obtener foto de perfil`);
        return null;
      }

      // Formatear número para WhatsApp (debe tener formato internacional sin +)
      const cleanPhone = telefono.replace(/\D/g, '');

      const axios = await import('axios');
      const evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
      const apiKey = process.env.EVOLUTION_API_KEY;

      if (!apiKey) {
        this.logger.warn('⚠️ EVOLUTION_API_KEY no configurado, omitiendo foto de perfil');
        return null;
      }

      this.logger.log(`📸 Obteniendo foto de perfil para ${cleanPhone}...`);

      const response = await axios.default.post(
        `${evolutionApiUrl}/chat/fetchProfilePictureUrl/${instanceName}`,
        { number: cleanPhone },
        {
          headers: {
            'Content-Type': 'application/json',
            apikey: apiKey,
          },
          timeout: 5000, // 5 segundos máximo
        },
      );

      if (response.data?.profilePictureUrl) {
        this.logger.log(`✅ Foto de perfil obtenida para ${cleanPhone}`);
        return response.data.profilePictureUrl;
      }

      this.logger.log(`ℹ️ No hay foto de perfil disponible para ${cleanPhone}`);
      return null;
    } catch (error) {
      // No es crítico si falla, simplemente no enviamos la foto
      const errorMsg = error.response?.data?.message || error.message;
      this.logger.warn(`⚠️ Error obteniendo foto de perfil: ${errorMsg}`);
      return null;
    }
  }
}
