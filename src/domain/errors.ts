import { Data } from "effect";

export class LightpandaError extends Data.TaggedError("LightpandaError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class NavigationError extends Data.TaggedError("NavigationError")<{
  readonly url: string;
  readonly cause?: unknown;
}> {}

// biome-ignore lint/suspicious/noShadowRestrictedNames: EvalError is the correct domain name for this error type
export class EvalError extends Data.TaggedError("EvalError")<{
  readonly expression: string;
  readonly cause?: unknown;
}> {}
