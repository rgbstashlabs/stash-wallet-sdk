import { TransportError } from '../errors';
export type { TransportErrorCode } from '../errors';
export { TransportError };

export interface Transport {
  send<TPayload = unknown, TResult = unknown>(
    type: string,
    payload?: TPayload,
  ): Promise<TResult>;
}

export interface TransportOptions {
  /** Request timeout in ms. Timeout does NOT cancel on-chain / Lightning operations. */
  timeoutMs?: number;
}
