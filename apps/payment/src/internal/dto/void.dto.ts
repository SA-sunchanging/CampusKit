import type { VoidRequest } from '../../ledger/void.js';
import { OperationDto } from './operation.dto.js';

/** Body of POST /internal/payments/void. */
export class VoidDto extends OperationDto implements VoidRequest {}
