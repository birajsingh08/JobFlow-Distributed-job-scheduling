import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.config.get('JWT_SECRET'),
      });

      client.data.userId = payload.sub;
      this.logger.debug(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch (err) {
      this.logger.warn(`Unauthorized WebSocket connection: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:project')
  handleSubscribeProject(client: Socket, projectId: string) {
    client.join(`project:${projectId}`);
    this.logger.debug(`Client ${client.id} subscribed to project ${projectId}`);
    return { subscribed: true, projectId };
  }

  @SubscribeMessage('unsubscribe:project')
  handleUnsubscribeProject(client: Socket, projectId: string) {
    client.leave(`project:${projectId}`);
    return { unsubscribed: true, projectId };
  }

  @SubscribeMessage('subscribe:queue')
  handleSubscribeQueue(client: Socket, queueId: string) {
    client.join(`queue:${queueId}`);
    return { subscribed: true, queueId };
  }

  // ──────── Domain Event Handlers ────────

  @OnEvent('job.created')
  handleJobCreated(payload: { job: any; queueId: string; projectId: string }) {
    this.server.to(`project:${payload.projectId}`).emit('job:created', payload.job);
    this.server.to(`queue:${payload.queueId}`).emit('job:created', payload.job);
  }

  @OnEvent('job.started')
  handleJobStarted(payload: { jobId: string; queueId: string; projectId: string }) {
    this.server.to(`project:${payload.projectId}`).emit('job:started', payload);
    this.server.to(`queue:${payload.queueId}`).emit('job:started', payload);
  }

  @OnEvent('job.completed')
  handleJobCompleted(payload: any) {
    this.server.to(`project:${payload.projectId}`).emit('job:completed', payload);
    this.server.to(`queue:${payload.queueId}`).emit('job:completed', payload);
  }

  @OnEvent('job.failed')
  handleJobFailed(payload: any) {
    this.server.to(`project:${payload.projectId}`).emit('job:failed', payload);
    this.server.to(`queue:${payload.queueId}`).emit('job:failed', payload);
  }

  @OnEvent('job.retrying')
  handleJobRetrying(payload: any) {
    this.server.to(`project:${payload.projectId}`).emit('job:retrying', payload);
  }

  @OnEvent('job.dead')
  handleJobDead(payload: any) {
    this.server.to(`project:${payload.projectId}`).emit('job:dead', payload);
  }

  @OnEvent('job.cancelled')
  handleJobCancelled(payload: any) {
    this.server.to(`project:${payload.projectId}`).emit('job:cancelled', payload);
  }

  @OnEvent('queue.created')
  handleQueueCreated(payload: any) {
    this.server.to(`project:${payload.projectId}`).emit('queue:created', payload);
  }

  @OnEvent('queue.updated')
  handleQueueUpdated(payload: any) {
    this.server.to(`project:${payload.projectId}`).emit('queue:updated', payload);
  }

  @OnEvent('queue.paused')
  handleQueuePaused(payload: any) {
    this.server.to(`project:${payload.projectId}`).emit('queue:paused', payload);
  }

  @OnEvent('queue.resumed')
  handleQueueResumed(payload: any) {
    this.server.to(`project:${payload.projectId}`).emit('queue:resumed', payload);
  }

  @OnEvent('worker.died')
  handleWorkerDied(payload: any) {
    this.server.emit('worker:died', payload);
  }

  // Broadcast system metrics every 10 seconds
  broadcastMetrics(metrics: any) {
    this.server.emit('metrics:update', metrics);
  }
}
