import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../shared/redis.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  },
  transports: ['websocket', 'polling']
})
@Injectable()
export class KYCWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;
  
  private readonly logger = new Logger(KYCWebSocketGateway.name);

  constructor(
    private readonly redisService: RedisService,
  ) {
    this.subscribeToRedis();
  }

  onModuleInit() {
    this.logger.log('WebSocket gateway initialized and accepting connections');
  }
  
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.query.token;
      if (!token) {
        return;
      }
      // Token validation can be added here when auth integration is ready.
    } catch (error) {
      this.logger.error('WebSocket connection error', error);
      client.disconnect();
    }
  }
  
  handleDisconnect(client: Socket) {
  }
  
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { verificationId: string }
  ) {
    if (!data) {
      this.logger.warn(`Subscribe event received without data from client ${client.id}`);
      client.emit('verification_error', {
        message: 'Invalid request: verificationId is required',
        verificationId: null
      });
      return;
    }
    
    const verificationId = data?.verificationId || (data as any)?.verification_id;
    await this.joinVerificationRoom(client, verificationId, 'subscribe');
  }

  @SubscribeMessage('join_verification')
  async handleJoinVerification(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { verificationId: string }
  ) {
    if (!data) {
      this.logger.warn(`Join verification event received without data from client ${client.id}`);
      client.emit('verification_error', {
        message: 'Invalid request: verificationId is required',
        verificationId: null
      });
      return;
    }
    
    const verificationId = data?.verificationId || (data as any)?.verification_id;
    await this.joinVerificationRoom(client, verificationId, 'join_verification');
  }
  
  private async joinVerificationRoom(client: Socket, verificationId: string | undefined, eventName: string) {
    try {
      // Validate verificationId
      if (!verificationId || typeof verificationId !== 'string' || verificationId.trim() === '') {
        this.logger.warn(`Invalid verificationId received: ${verificationId} (type: ${typeof verificationId}) from client ${client.id} via ${eventName}`);
        client.emit('verification_error', {
          message: 'Invalid verificationId. Please provide a valid verification ID.',
          verificationId: verificationId || null,
          event: eventName
        });
        return;
      }
      
      // Join room for this verification
      const room = `verification:${verificationId}`;
      await client.join(room);
      
      // Acknowledge the join
      client.emit('subscribed', {
        verificationId,
        room
      });
    } catch (error) {
      this.logger.error(`Error joining room for verification ${verificationId}:`, error);
      // Use custom event name instead of reserved 'error' event
      client.emit('verification_error', {
        message: 'Failed to join verification room',
        verificationId: verificationId || null,
        error: error.message
      });
    }
  }
  
  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { verificationId: string }
  ) {
    const verificationId = data?.verificationId;
    
    if (!verificationId || typeof verificationId !== 'string' || verificationId.trim() === '') {
      this.logger.warn(`Invalid verificationId for unsubscribe: ${verificationId}`);
      client.emit('verification_error', {
        message: 'Invalid verificationId for unsubscribe',
        verificationId: verificationId || null
      });
      return;
    }
    
    const room = `verification:${verificationId}`;
    await client.leave(room);
    
    client.emit('unsubscribed', {
      verificationId
    });
  }
  
  private subscribeToRedis() {
    // Subscribe to Redis pub/sub channel
    this.redisService.subscribe('verification-events', (message) => {
      try {
        const event = JSON.parse(message);
        
        if (!event.verificationId) {
          this.logger.error(`Redis event missing verificationId: ${JSON.stringify(event)}`);
          return;
        }
        
        this.broadcast(event.verificationId, event);
      } catch (error) {
        this.logger.error(`Error processing Redis message: ${error.message}`, error);
      }
    });
  }
  
  async broadcast(verificationId: string, data: any) {
    // Validate verificationId
    if (!verificationId || typeof verificationId !== 'string' || verificationId.trim() === '') {
      this.logger.error(`Cannot broadcast: Invalid verificationId (${verificationId})`);
      return;
    }
    
    const room = `verification:${verificationId}`;
    
    // Get number of clients in room before broadcasting
    const socketsInRoom = await this.server.in(room).fetchSockets();
    const clientCount = socketsInRoom.length;
    
    // Broadcast to all clients in the room
    this.server.to(room).emit(data.event, data);
    
    if (clientCount === 0) {
      this.logger.warn(`No clients in room ${room} to receive the broadcast`);
    }
  }
}
