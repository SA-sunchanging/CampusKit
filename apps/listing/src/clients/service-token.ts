import { ServiceTokenSigner } from '@app/common';

/**
 * Signs the token Listing sends on its internal calls
 * (docs/adr/adr-010-authenticate-internal-calls-with-service-tokens.md).
 */
export const serviceTokens = new ServiceTokenSigner('listing');
