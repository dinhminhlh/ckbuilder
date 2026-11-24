/*
 * Adapted from CKBolt ckbolt-hub/src/infrastructure/fiber/fiber-rpc.errors.ts (commit e2bba3c).
 * Change for Fiber Fiber RPS: the NestJS `HubError` base class (HTTP status, API error code) was replaced with plain
 * `Error`, and the invoice-specific error classes, which this game does not use, were removed.
 */

/**
 * Errors of the fnn JSON-RPC layer.
 * - FiberRpcTransportError: the call may or may not have reached the node (network, timeout, HTTP status, not JSON-RPC).
 *   Callers must treat the outcome as unknown and re-read state before acting.
 * - FiberRpcResponseError: the node answered, but with data the hub cannot read (usually an fnn version mismatch).
 * - FiberRpcError: the node answered with a JSON-RPC error object; the call did not happen.
 */

export const FIBER_TRANSPORT_FAILURE = {
  NETWORK: "network",
  TIMEOUT: "timeout",
  HTTP_STATUS: "http_status",
  INVALID_RESPONSE: "invalid_response",
} as const;

export type FiberTransportFailure = (typeof FIBER_TRANSPORT_FAILURE)[keyof typeof FIBER_TRANSPORT_FAILURE];

export class FiberRpcTransportError extends Error {
  constructor(
    readonly method: string,
    readonly failure: FiberTransportFailure,
    readonly detail: string,
  ) {
    super(`The Fiber node did not answer ${method} (${failure}): ${detail}. The outcome is unknown; re-read state before retrying.`);
    this.name = "FiberRpcTransportError";
  }
}

export class FiberRpcResponseError extends Error {
  constructor(readonly detail: string) {
    super(`The Fiber node sent data this app cannot read: ${detail}`);
    this.name = "FiberRpcResponseError";
  }
}

export class FiberRpcError extends Error {
  constructor(
    readonly method: string,
    readonly code: number,
    readonly rpcMessage: string,
    readonly data?: unknown,
  ) {
    super(`fnn ${method} failed (${code}): ${rpcMessage}`);
    this.name = "FiberRpcError";
  }
}

/** True for a JSON-RPC error from fnn whose message matches `pattern`. */
export const isFiberRpcErrorMatching = (error: unknown, pattern: RegExp): error is FiberRpcError =>
  error instanceof FiberRpcError && pattern.test(error.rpcMessage);
