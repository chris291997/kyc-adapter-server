import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Provider } from '../database/entities/provider.entity';
import { TenantProviderConfig } from '../database/entities/tenant-provider-config.entity';
import { ProvidersFactory } from './providers.factory';
import { IDmetaProvider } from './implementations/idmeta/idmeta.provider';
import { IDmetaHttpClient } from './implementations/idmeta/idmeta-http.client';
import { IDmetaRequestMapper } from './implementations/idmeta/mappers/idmeta-request.mapper';
import { IDmetaResponseMapper } from './implementations/idmeta/mappers/idmeta-response.mapper';
import { MockProvider } from './implementations/mock/mock.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Provider, TenantProviderConfig]),
  ],
  providers: [
    ProvidersFactory,
    IDmetaProvider,
    IDmetaHttpClient,
    IDmetaRequestMapper,
    IDmetaResponseMapper,
    MockProvider,
  ],
  exports: [
    ProvidersFactory,
    IDmetaProvider,
    MockProvider,
  ],
})
export class ProvidersModule {}


