# KYC Adapter Backend

A provider-agnostic KYC verification system built with NestJS, supporting multiple verification providers with different workflows (single-step, multi-step, webhook-based).

## 🚀 Quick Start

### Prerequisites

- Node.js v20.x LTS or higher
- npm v10.x or higher
- Docker v24.x or higher
- Docker Compose v2.x or higher
- PostgreSQL v14 or higher
- Redis v7 or higher

### Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Start infrastructure:**
```bash
docker-compose up -d
```

3. **Configure environment:**
```bash
cp env.example .env
# Edit .env with your configuration
```

4. **Run database migrations:**
```bash
npm run migration:run
```

5. **Start development server:**
```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`
API documentation at `http://localhost:3000/api/docs`

## 🏗️ Architecture

### Core Features

- **Provider Agnostic**: Works with any KYC provider through configuration
- **Multi-tenant**: Complete data isolation between tenants
- **Real-time**: WebSocket updates for verification progress
- **Webhook System**: Bidirectional webhook communication
- **Security First**: JWT authentication, API keys, encryption, audit logging

### Technology Stack

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL with TypeORM
- **Cache/Queue**: Redis with Bull
- **Real-time**: Socket.IO with Redis adapter
- **Authentication**: JWT + API keys
- **Documentation**: Swagger/OpenAPI

### Project Structure

```
src/
├── auth/                 # Authentication & authorization
├── database/            # Entities, migrations, seeds
├── providers/            # Provider abstraction layer
│   ├── interfaces/     # IKycProvider interface
│   ├── implementations/ # IDmeta, Regula, Persona providers
│   └── mappers/        # Request/response mappers
├── verifications/      # Core verification logic
├── webhooks/          # Webhook handling
├── websocket/         # Real-time updates
├── admin/             # Admin API endpoints
├── tenant/            # Tenant API endpoints
├── common/            # Shared utilities
└── main.ts
```

## 🔧 Configuration

### Environment Variables

Copy `env.example` to `.env` and configure:

```bash
# Application
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=kyc_adapter

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-256-bits
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-here

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## 📚 API Documentation

Once running, visit `http://localhost:3000/api/docs` for interactive API documentation.

### Key Endpoints

- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /verifications/initiate` - Start verification
- `POST /verifications/{id}/documents` - Upload documents
- `GET /verifications/{id}/status` - Check status
- `POST /webhooks/providers/{id}` - Provider webhooks
- `GET /admin/dashboard` - Admin dashboard
- `GET /tenant/dashboard` - Tenant dashboard

## 🔌 Provider Integration

### Supported Providers

- **IDmeta**: Multi-step verification with hosted workflow
- **Regula**: Single-step document processing
- **Persona**: Async webhook-based verification
- **Mock**: Testing provider

### Adding New Providers

1. Create provider implementation in `src/providers/implementations/`
2. Implement `IKycProvider` interface
3. Add HTTP client and mappers
4. Register in `ProvidersFactory`
5. Add to database

## 🔒 Security

- JWT authentication with refresh tokens
- API key authentication for tenants
- HMAC webhook signature verification
- AES-256 encryption for sensitive data
- Rate limiting per IP and API key
- Comprehensive audit logging
- Row-level security for multi-tenancy

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 🚀 Deployment

### Docker

```bash
# Build image
docker build -t kyc-adapter-backend .

# Run container
docker run -p 3000:3000 kyc-adapter-backend
```

### Production Checklist

- [ ] Set strong JWT secret
- [ ] Configure encryption key
- [ ] Set up SSL/TLS
- [ ] Configure production database
- [ ] Set up Redis cluster
- [ ] Configure monitoring
- [ ] Set up logging
- [ ] Configure backup strategy

## 📖 Documentation

Complete documentation is available in the Obsidian vault "KYC-Adapter" with 55+ detailed documents covering:

- System architecture
- Provider integration
- Security practices
- API reference
- Deployment guides
- Troubleshooting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the troubleshooting guide
- Review the API documentation
- Open an issue on GitHub

---

**Built with ❤️ using NestJS and TypeScript**
