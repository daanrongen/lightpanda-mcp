import { Effect, Layer, Ref } from "effect";
import { LightpandaError } from "../domain/errors.ts";
import { LightpandaClient } from "../domain/LightpandaClient.ts";
import { Link, PageContent } from "../domain/models.ts";

const MOCK_SCREENSHOT =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export const LightpandaClientTest = Layer.effect(
  LightpandaClient,
  Effect.gen(function* () {
    const currentPageRef = yield* Ref.make<PageContent>(
      new PageContent({
        url: "about:blank",
        title: "",
        text: "",
        links: [],
        truncated: false,
      }),
    );

    return LightpandaClient.of({
      navigate: (url, _waitUntil) =>
        Effect.gen(function* () {
          const page = new PageContent({
            url,
            title: `Test page — ${url}`,
            text: `This is mock content for ${url}`,
            links: [new Link({ text: "Example", href: "https://example.com" })],
            truncated: false,
          });
          yield* Ref.set(currentPageRef, page);
          return page;
        }),

      getContent: (_selector) => Ref.get(currentPageRef),

      getHtml: (_selector) => Effect.succeed({ html: "<body>mock html</body>" }),

      waitForSelector: (_selector, _timeout) => Effect.void,

      click: (_selector) => Effect.void,

      fill: (_selector, _value) => Effect.void,

      screenshot: () => Effect.succeed(MOCK_SCREENSHOT),

      evaluate: (expression) =>
        Effect.tryPromise({
          try: async () => {
            // biome-ignore lint/security/noGlobalEval: test adapter evaluates expressions for testing purposes
            const result = eval(expression);
            return JSON.stringify(result);
          },
          catch: (e) => new LightpandaError({ message: `evaluate failed: ${String(e)}`, cause: e }),
        }),
    });
  }),
);
