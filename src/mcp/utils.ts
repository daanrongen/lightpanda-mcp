import type { Cause, Effect, ManagedRuntime } from "effect";
import { Cause as CauseModule } from "effect";
import type { LightpandaError } from "../domain/errors.ts";
import type { LightpandaClient } from "../domain/LightpandaClient.ts";

export const formatSuccess = (data: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(data, null, 2),
    },
  ],
});

export const formatImage = (data: string, mimeType: string) => ({
  content: [
    {
      type: "image" as const,
      data,
      mimeType,
    },
  ],
});

export const formatError = (cause: Cause.Cause<unknown>) => ({
  content: [
    {
      type: "text" as const,
      text: `Error: ${CauseModule.pretty(cause)}`,
    },
  ],
  isError: true as const,
});

type ToolContent = ReturnType<typeof formatSuccess> | ReturnType<typeof formatImage>;

export const runTool = async <A, E>(
  runtime: ManagedRuntime.ManagedRuntime<LightpandaClient, LightpandaError>,
  effect: Effect.Effect<A, E, LightpandaClient>,
  toContent: (value: A) => ToolContent,
) => {
  const result = await runtime.runPromiseExit(effect);
  if (result._tag === "Failure") return formatError(result.cause);
  return toContent(result.value);
};
