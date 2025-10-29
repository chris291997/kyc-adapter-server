import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Verification } from '../database/entities/verification.entity';
import { AuthService } from '../auth/auth.service';
import { RedisService } from '../shared/redis.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  },
  transports: ['websocket', 'polling']
})
@Injectable()
export class KYCWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private readonly logger = new Logger(KYCWebSocketGateway.name);

  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    private readonly authService: AuthService,
    private readonly redisService: RedisService,
  ) {
    this.subscribeToRedis();
  }
  
  async handleConnection(client: Socket) {
    try {
      // Authenticate client
      const token = client.handshake.auth.token || client.handshake.query.token;
      
      // Allow connections without token for testing
      if (token) {
        // TODO: Implement token validation
        // const user = await this.authService.validateToken(token);
        
        // if (!user) {
        //   client.disconnect();
        //   return;
        // }
        
        // Store user info in socket
        // client.data.user = user;
      }
      
      this.logger.log(`🔌 Client connected: ${client.id}`);
      
    } catch (error) {
      this.logger.error('WebSocket connection error', error);
      client.disconnect();
    }
  }
  
  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 Client disconnected: ${client.id}`);
  }
  
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { verificationId: string }
  ) {
    this.logger.debug(`📥 Subscribe event received from ${client.id}:`, JSON.stringify(data));
    
    if (!data) {
      this.logger.warn(`⚠️  Subscribe event received without data from client ${client.id}`);
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
    this.logger.debug(`📥 Join verification event received from ${client.id}:`, JSON.stringify(data));
    
    if (!data) {
      this.logger.warn(`⚠️  Join verification event received without data from client ${client.id}`);
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
        this.logger.warn(`⚠️  Invalid verificationId received: ${verificationId} (type: ${typeof verificationId}) from client ${client.id} via ${eventName}`);
        client.emit('verification_error', {
          message: 'Invalid verificationId. Please provide a valid verification ID.',
          verificationId: verificationId || null,
          event: eventName
        });
        return;
      }
      
      // TODO: Implement user validation
      // const user = client.data.user;
      
      // Verify user has access to this verification
      // const hasAccess = await this.verifyAccess(user, verificationId);
      
      // if (!hasAccess) {
      //   client.emit('error', {
      //     message: 'Access denied to this verification'
      //   });
      //   return;
      // }
      
      // Join room for this verification
      const room = `verification:${verificationId}`;
      await client.join(room);
      
      this.logger.log(`🔔 Client ${client.id} joined room: ${room} (via ${eventName})`);
      
      // Get clients in room for debugging
      const socketsInRoom = await this.server.in(room).fetchSockets();
      this.logger.log(`📊 Room ${room} now has ${socketsInRoom.length} client(s)`);
      
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
      this.logger.warn(`⚠️  Invalid verificationId for unsubscribe: ${verificationId}`);
      client.emit('verification_error', {
        message: 'Invalid verificationId for unsubscribe',
        verificationId: verificationId || null
      });
      return;
    }
    
    const room = `verification:${verificationId}`;
    await client.leave(room);
    
    this.logger.log(`🚪 Client ${client.id} left room: ${room}`);
    
    client.emit('unsubscribed', {
      verificationId
    });
  }
  
  private async verifyAccess(user: any, verificationId: string): Promise<boolean> {
    // Admin has access to all
    if (user.type === 'admin') return true;
    
    // Tenant has access to their own verifications
    if (user.type === 'tenant') {
      const verification = await this.verificationRepository.findOne({
        where: { id: verificationId, tenant_id: user.tenantId }
      });
      return !!verification;
    }
    
    // API key has access to verifications created with that key
    if (user.type === 'api_key') {
      const verification = await this.verificationRepository.findOne({
        where: { id: verificationId, tenant_id: user.tenantId }
      });
      return !!verification;
    }
    
    return false;
  }
  
  private subscribeToRedis() {
    this.logger.log('📡 Subscribing to Redis channel: verification-events');
    
    // Subscribe to Redis pub/sub channel
    this.redisService.subscribe('verification-events', (message) => {
      this.logger.log(`📨 Received Redis message from verification-events channel`);
      
      try {
        const event = JSON.parse(message);
        this.logger.debug(`📥 Parsed event: ${JSON.stringify(event)}`);
        
        if (!event.verificationId) {
          this.logger.error(`⚠️  Redis event missing verificationId: ${JSON.stringify(event)}`);
          return;
        }
        
        this.logger.log(`🔄 Broadcasting event "${event.event}" to verification ${event.verificationId}`);
        this.broadcast(event.verificationId, event);
      } catch (error) {
        this.logger.error(`⚠️  Error processing Redis message: ${error.message}`, error);
        this.logger.debug(`Message content: ${message}`);
      }
    });
    
    this.logger.log('✅ Successfully subscribed to Redis channel');
  }
  
  async broadcast(verificationId: string, data: any) {
    // Validate verificationId
    if (!verificationId || typeof verificationId !== 'string' || verificationId.trim() === '') {
      this.logger.error(`⚠️  Cannot broadcast: Invalid verificationId (${verificationId})`);
      return;
    }
    
    const room = `verification:${verificationId}`;
    
    // Get number of clients in room before broadcasting
    const socketsInRoom = await this.server.in(room).fetchSockets();
    const clientCount = socketsInRoom.length;
    
    // Broadcast to all clients in the room
    this.server.to(room).emit(data.event, data);
    
    this.logger.log(`📡 Broadcasting "${data.event}" to room ${room} (${clientCount} client(s) listening)`);
    
    // Log the event data for debugging
    this.logger.debug(`Event data: ${JSON.stringify(data, null, 2)}`);
    
    if (clientCount === 0) {
      this.logger.warn(`⚠️  No clients in room ${room} to receive the broadcast`);
    }
  }
}
