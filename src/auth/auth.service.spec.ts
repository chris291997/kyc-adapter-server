import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from '../database/entities/user.entity';
import { ApiKey } from '../database/entities/api-key.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let apiKeyRepository: Repository<ApiKey>;
  let refreshTokenRepository: Repository<RefreshToken>;
  let jwtService: JwtService;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockApiKeyRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
  };

  const mockRefreshTokenRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(ApiKey),
          useValue: mockApiKeyRepository,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    apiKeyRepository = module.get<Repository<ApiKey>>(getRepositoryToken(ApiKey));
    refreshTokenRepository = module.get<Repository<RefreshToken>>(getRepositoryToken(RefreshToken));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: '$2b$10$hashedpassword',
        user_type: 'tenant_admin',
        tenant_id: 'tenant-123',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        relations: ['tenant'],
      });
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: '$2b$10$hashedpassword',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return tokens and user data on successful login', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        user_type: 'tenant_admin',
        tenant_id: 'tenant-123',
        password_hash: 'hashed-password',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        tenant: { id: 'tenant-123', name: 'Test Tenant' },
      };

      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      jest.spyOn(service, 'validateUser').mockResolvedValue(mockUser as any);
      mockJwtService.sign.mockReturnValue('jwt-token');
      jest.spyOn(service, 'createRefreshToken' as any).mockResolvedValue('refresh-token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        access_token: 'jwt-token',
        refresh_token: 'refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          userType: 'tenant_admin',
          tenantId: 'tenant-123',
          tenant: { id: 'tenant-123', name: 'Test Tenant' },
        },
      });
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      jest.spyOn(service, 'validateUser').mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should create new user successfully', async () => {
      const registerDto: RegisterDto = {
        firstName: 'New',
        lastName: 'User',
        phone: '+1234567890',
        email: 'new@example.com',
        password: 'password123',
        userType: 'tenant_user',
        tenantId: 'tenant-123',
      };

      const mockUser = {
        id: 'user-123',
        email: 'new@example.com',
        name: 'New User',
        name_details: { first: 'New', last: 'User' },
        phone: '+1234567890',
        user_type: 'tenant_user',
        tenant_id: 'tenant-123',
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      jest.spyOn(require('bcryptjs'), 'hash').mockResolvedValue('hashed-password');

      const result = await service.register(registerDto);

      expect(result).toEqual({
        id: 'user-123',
        email: 'new@example.com',
        name: 'New User',
        name_details: { first: 'New', last: 'User' },
        phone: '+1234567890',
        userType: 'tenant_user',
        tenantId: 'tenant-123',
      });
    });

    it('should throw BadRequestException when user already exists', async () => {
      const registerDto: RegisterDto = {
        firstName: 'Existing',
        lastName: 'User',
        email: 'existing@example.com',
        password: 'password123',
        userType: 'tenant_user',
        tenantId: 'tenant-123',
      };

      mockUserRepository.findOne.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createApiKey', () => {
    it('should create API key successfully', async () => {
      const createApiKeyDto: CreateApiKeyDto = {
        name: 'Test API Key',
        scopes: ['verifications:read', 'verifications:write'],
        expires_in_days: 30,
      };

      const mockApiKey = {
        id: 'api-key-123',
        key_hash: 'hashed-key',
        key_prefix: 'kyc_live',
        name: 'Test API Key',
        scopes: ['verifications:read', 'verifications:write'],
        expires_at: new Date(),
        created_at: new Date(),
      };

      mockApiKeyRepository.create.mockReturnValue(mockApiKey);
      mockApiKeyRepository.save.mockResolvedValue(mockApiKey);

      const result = await service.createApiKey('user-123', createApiKeyDto);

      expect(result).toHaveProperty('id', 'api-key-123');
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('key_prefix', 'kyc_live');
      expect(result).toHaveProperty('name', 'Test API Key');
    });
  });

  describe('validateApiKey', () => {
    it('should return user and API key when valid', async () => {
      const mockApiKey = {
        id: 'api-key-123',
        user_id: 'user-123',
        key_hash: 'hashed-key',
        is_active: true,
        expires_at: new Date(Date.now() + 86400000), // 1 day from now
        user: {
          id: 'user-123',
          email: 'test@example.com',
          user_type: 'tenant_admin',
          tenant_id: 'tenant-123',
        },
      };

      mockApiKeyRepository.findOne.mockResolvedValue(mockApiKey);
      mockApiKeyRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.validateApiKey('valid-api-key');

      expect(result).toEqual({
        user: mockApiKey.user,
        apiKey: mockApiKey,
      });
    });

    it('should return null when API key not found', async () => {
      mockApiKeyRepository.findOne.mockResolvedValue(null);

      const result = await service.validateApiKey('invalid-api-key');

      expect(result).toBeNull();
    });

    it('should return null when API key is expired', async () => {
      const mockApiKey = {
        id: 'api-key-123',
        expires_at: new Date(Date.now() - 86400000), // 1 day ago
      };

      mockApiKeyRepository.findOne.mockResolvedValue(mockApiKey);

      const result = await service.validateApiKey('expired-api-key');

      expect(result).toBeNull();
    });
  });
});
