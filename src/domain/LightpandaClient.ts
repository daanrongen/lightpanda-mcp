import { Context, type Effect } from "effect";
// biome-ignore lint/suspicious/noShadowRestrictedNames: EvalError is the correct domain name for this error type
import type { EvalError, LightpandaError, NavigationError } from "./errors.ts";
import type { PageContent } from "./models.ts";

export interface LightpandaClientService {
  readonly navigate: (
    url: string,
    waitUntil?: "load" | "networkidle0" | "networkidle2",
  ) => Effect.Effect<PageContent, LightpandaError | NavigationError>;
  readonly getContent: (selector?: string) => Effect.Effect<PageContent, LightpandaError>;
  readonly getHtml: (selector?: string) => Effect.Effect<{ html: string }, LightpandaError>;
  readonly waitForSelector: (
    selector: string,
    timeout?: number,
  ) => Effect.Effect<void, LightpandaError>;
  readonly click: (selector: string) => Effect.Effect<void, LightpandaError>;
  readonly fill: (selector: string, value: string) => Effect.Effect<void, LightpandaError>;
  readonly screenshot: () => Effect.Effect<string, LightpandaError>;
  readonly evaluate: (expression: string) => Effect.Effect<string, LightpandaError | EvalError>;
}

export class LightpandaClient extends Context.Tag("LightpandaClient")<
  LightpandaClient,
  LightpandaClientService
>() {}
