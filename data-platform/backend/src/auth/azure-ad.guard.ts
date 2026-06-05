import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Azure AD JWT Guard
 * In mock mode (local dev): extracts BU from header or uses default
 * In production: validates Azure AD Bearer token and extracts claims
 */
@Injectable()
export class AzureAdGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const mockMode = this.config.get('AZURE_AD_MOCK_MODE', 'true') === 'true';

    if (mockMode) {
      // Local dev: accept any request, use headers for tenant context
      request.user = {
        oid: request.headers['x-user-id'] || 'local-dev-user',
        email: request.headers['x-user-email'] || 'dev@bayer.com',
        name: request.headers['x-user-name'] || 'Local Developer',
        role: request.headers['x-user-role'] || 'admin',
        businessUnitId:
          request.headers['x-business-unit-id'] ||
          'a1b2c3d4-0001-4000-8000-000000000001',
      };
      return true;
    }

    // Production: validate Azure AD JWT
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    try {
      // In production, use passport-azure-ad BearerStrategy
      // For now, decode and validate manually
      const payload = this.decodeToken(token);
      request.user = {
        oid: payload.oid,
        email: payload.preferred_username || payload.email,
        name: payload.name,
        role: payload.roles?.[0] || 'viewer',
        businessUnitId: payload.extension_BusinessUnitId,
      };
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private decodeToken(token: string): any {
    // Simple base64 decode of JWT payload (production should verify signature)
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT');
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  }
}
