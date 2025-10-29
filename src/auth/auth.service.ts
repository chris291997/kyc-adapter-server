import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from '../database/entities/user.entity';
import { ApiKey } from '../database/entities/api-key.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ 
      where: { email },
      relations: ['tenant']
    });
    if (user && await bcrypt.compare(password, user.password_hash)) {
      return user;
    }
    return null;
  }

  async validateApiKey(apiKey: string): Promise<{ user: User; apiKey: ApiKey } | null> {
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    const apiKeyEntity = await this.apiKeyRepository.findOne({
      where: { key_hash: hashedKey, is_active: true },
      relations: ['user', 'user.tenant'],
    });

    if (!apiKeyEntity) {
      return null;
    }

    // Check if API key is expired
    if (apiKeyEntity.expires_at && apiKeyEntity.expires_at < new Date()) {
      return null;
    }

    // Update last used timestamp
    await this.apiKeyRepository.update(apiKeyEntity.id, {
      last_used_at: new Date(),
    });

    return {
      user: apiKeyEntity.user,
      apiKey: apiKeyEntity,
    };
  }

  async login(loginDto: LoginDto) {
    try {
      const { email, password } = loginDto;

      const user = await this.validateUser(email, password);
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = {
        sub: user.id,
        email: user.email,
        userType: user.user_type,
        tenantId: user.tenant_id,
      };

      const accessToken = this.jwtService.sign(payload);
      const refreshToken = await this.createRefreshToken(user.id);

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          userType: user.user_type,
          tenantId: user.tenant_id,
          tenant: user.tenant,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, phone, userType, tenantId } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Build name from firstName/lastName or use email prefix
    const name = firstName && lastName 
      ? `${firstName} ${lastName}`.trim()
      : firstName || lastName || email.split('@')[0];

    // Build name_details if firstName/lastName provided
    const nameDetails = (firstName || lastName) ? {
      first: firstName || '',
      last: lastName || '',
    } : undefined;

    // Create user
    const user = this.userRepository.create({
      email,
      password_hash: passwordHash,
      name,
      name_details: nameDetails,
      phone,
      user_type: userType,
      tenant_id: tenantId,
    });

    await this.userRepository.save(user);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      name_details: user.name_details,
      phone: user.phone,
      userType: user.user_type,
      tenantId: user.tenant_id,
    };
  }

  async refreshToken(refreshToken: string) {
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const tokenEntity = await this.refreshTokenRepository.findOne({
      where: { token_hash: hashedToken },
      relations: ['user', 'user.tenant'],
    });

    if (!tokenEntity || tokenEntity.revoked_at || tokenEntity.expires_at < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const payload = {
      sub: tokenEntity.user.id,
      email: tokenEntity.user.email,
      userType: tokenEntity.user.user_type,
      tenantId: tokenEntity.user.tenant_id,
    };

    const accessToken = this.jwtService.sign(payload);
    const newRefreshToken = await this.createRefreshToken(tokenEntity.user.id);

    // Revoke old refresh token
    await this.refreshTokenRepository.update(tokenEntity.id, {
      revoked_at: new Date(),
    });

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
    };
  }

  async createApiKey(userId: string, createApiKeyDto: CreateApiKeyDto) {
    const { name, scopes, expiresAt, expires_in_days } = createApiKeyDto;

    // Generate API key
    const apiKey = `kyc_live_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.substring(0, 8);

    // Calculate expiration date
    let expirationDate: Date | null = null;
    if (expiresAt) {
      expirationDate = new Date(expiresAt);
    } else if (expires_in_days) {
      expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expires_in_days);
    }

    const apiKeyEntity = this.apiKeyRepository.create({
      user_id: userId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name,
      scopes: scopes || [],
      expires_at: expirationDate,
    });

    await this.apiKeyRepository.save(apiKeyEntity);

    return {
      id: apiKeyEntity.id,
      key: apiKey, // Only returned once
      key_prefix: keyPrefix,
      name,
      scopes: apiKeyEntity.scopes,
      expires_at: apiKeyEntity.expires_at,
      created_at: apiKeyEntity.created_at,
    };
  }

  async getApiKeys(userId: string) {
    return this.apiKeyRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async revokeApiKey(userId: string, apiKeyId: string) {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id: apiKeyId, user_id: userId },
    });

    if (!apiKey) {
      throw new BadRequestException('API key not found');
    }

    await this.apiKeyRepository.update(apiKeyId, { is_active: false });
    return { message: 'API key revoked successfully' };
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const tokenEntity = this.refreshTokenRepository.create({
      user_id: userId,
      token_hash: hashedToken,
      expires_at: expiresAt,
    });

    await this.refreshTokenRepository.save(tokenEntity);
    return refreshToken;
  }
}
