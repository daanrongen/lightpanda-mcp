import { Context, type Effect } from "effect";
// biome-ignore-start lint/suspicious/noShadowRestrictedNames: EvalError is the correct domain name for this error type
import type {
  ConnectionLostError,
  EvalError,
  LightpandaError,
  NavigationError,
  ScreenshotNotSupportedError,
} from "./errors.ts";
// biome-ignore-end lint/suspicious/noShadowRestrictedNames: end
import type { PageContent } from "./models.ts";

export interface LightpandaClientService {
  readonly navigate: (
    url: string,
    waitUntil?: "load" | "networkidle0" | "networkidle2",
  ) => Effect.Effect<PageContent, LightpandaError | NavigationError | ConnectionLostError>;
  readonly getContent: (
    selector?: string,
  ) => Effect.Effect<PageContent, LightpandaError | ConnectionLostError>;
  readonly getHtml: (
    selector?: string,
  ) => Effect.Effect<{ html: string }, LightpandaError | ConnectionLostError>;
  readonly waitForSelector: (
    selector: string,
    timeout?: number,
  ) => Effect.Effect<void, LightpandaError | ConnectionLostError>;
  readonly click: (selector: string) => Effect.Effect<void, LightpandaError | ConnectionLostError>;
  readonly fill: (
    selector: string,
    value: string,
  ) => Effect.Effect<void, LightpandaError | ConnectionLostError>;
  readonly screenshot: () => Effect.Effect<
    string,
    LightpandaError | ConnectionLostError | ScreenshotNotSupportedError
  >;
  readonly evaluate: (
    expression: string,
  ) => Effect.Effect<string, LightpandaError | EvalError | ConnectionLostError>;
}

export class LightpandaClient extends Context.Tag("LightpandaClient")<
  LightpandaClient,
  LightpandaClientService
>() {}
