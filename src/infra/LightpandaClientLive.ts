import { Effect, Layer, Ref } from "effect";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { LightpandaConfig } from "../config.ts";
// biome-ignore-start lint/suspicious/noShadowRestrictedNames: EvalError is the correct domain name for this error type
import {
  ConnectionLostError,
  EvalError,
  LightpandaError,
  NavigationError,
  ScreenshotNotSupportedError,
} from "../domain/errors.ts";
// biome-ignore-end lint/suspicious/noShadowRestrictedNames: end
import { LightpandaClient } from "../domain/LightpandaClient.ts";
import { Link, PageContent } from "../domain/models.ts";

const wrapPuppeteer = <A>(label: string, fn: () => Promise<A>): Effect.Effect<A, LightpandaError> =>
  Effect.tryPromise({
    try: fn,
    catch: (e) => new LightpandaError({ message: `${label} failed`, cause: e }),
  });

const requireNavigated = (page: Page): Effect.Effect<void, LightpandaError> =>
  page.url() === "about:blank"
    ? Effect.fail(
        new LightpandaError({
          message:
            "No page loaded — call navigate first before using get_content, get_html, click, fill, screenshot, evaluate, or wait_for_selector.",
        }),
      )
    : Effect.void;

const requireConnected = (
  connectedRef: Ref.Ref<boolean>,
): Effect.Effect<void, ConnectionLostError> =>
  Effect.gen(function* () {
    const connected = yield* Ref.get(connectedRef);
    if (!connected) {
      yield* Effect.fail(
        new ConnectionLostError({
          message:
            "CDP connection to Lightpanda has been lost and could not be re-established. Check that the Lightpanda server is running and restart the MCP server.",
        }),
      );
    }
  });

const MAX_TEXT_CHARS = 8000;
const MAX_LINKS = 50;
const RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 500;

const extractPageContent = async (page: Page, selector?: string): Promise<PageContent> => {
  const url = page.url();
  const title = await page.title();
  const { rawText, rawLinks } = await page.evaluate((sel) => {
    const root = sel ? document.querySelector(sel) : document.body;
    const el = root ?? document.body;
    const rawText = (el as HTMLElement).innerText ?? "";
    const rawLinks = [...el.querySelectorAll("a")].map((a) => ({
      text: (a as HTMLAnchorElement).innerText.trim().slice(0, 200),
      href: (a as HTMLAnchorElement).href,
    }));
    return { rawText, rawLinks };
  }, selector ?? null);
  const textTruncated = rawText.length > MAX_TEXT_CHARS;
  const linksTruncated = rawLinks.length > MAX_LINKS;
  return new PageContent({
    url,
    title,
    text: rawText.slice(0, MAX_TEXT_CHARS),
    links: rawLinks.slice(0, MAX_LINKS).map((l) => new Link(l)),
    truncated: textTruncated || linksTruncated,
  });
};

const connectBrowser = (wsEndpoint: string): Promise<Browser> =>
  puppeteer.connect({ browserWSEndpoint: wsEndpoint });

const scheduleReconnect = (
  wsEndpoint: string,
  browserRef: Ref.Ref<Browser>,
  pageRef: Ref.Ref<Page>,
  connectedRef: Ref.Ref<boolean>,
  attempt: number,
): void => {
  if (attempt > RECONNECT_ATTEMPTS) {
    process.stderr.write(
      `[lightpanda-mcp] Reconnect failed after ${RECONNECT_ATTEMPTS} attempts — giving up. Restart the MCP server.\n`,
    );
    Effect.runSync(Ref.set(connectedRef, false));
    return;
  }

  const delayMs = RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1);
  process.stderr.write(
    `[lightpanda-mcp] CDP disconnected — reconnect attempt ${attempt}/${RECONNECT_ATTEMPTS} in ${delayMs}ms…\n`,
  );

  setTimeout(async () => {
    try {
      const newBrowser = await connectBrowser(wsEndpoint);
      const newPage = await newBrowser.newPage();

      // Register the disconnected handler on the new browser
      newBrowser.on("disconnected", () => {
        scheduleReconnect(wsEndpoint, browserRef, pageRef, connectedRef, 1);
      });

      Effect.runSync(
        Effect.gen(function* () {
          yield* Ref.set(browserRef, newBrowser);
          yield* Ref.set(pageRef, newPage);
          yield* Ref.set(connectedRef, true);
        }),
      );

      process.stderr.write("[lightpanda-mcp] CDP reconnected successfully.\n");
    } catch (_err) {
      scheduleReconnect(wsEndpoint, browserRef, pageRef, connectedRef, attempt + 1);
    }
  }, delayMs);
};

export const LightpandaClientLive = Layer.scoped(
  LightpandaClient,
  Effect.gen(function* () {
    const wsEndpoint = yield* Effect.orDie(LightpandaConfig);

    const connectedRef = yield* Ref.make(true);

    const initialBrowser: Browser = yield* Effect.acquireRelease(
      wrapPuppeteer("connect", () => connectBrowser(wsEndpoint)),
      (b) => Effect.promise(() => b.disconnect()),
    );

    const initialPage: Page = yield* wrapPuppeteer("newPage", () => initialBrowser.newPage());

    const browserRef = yield* Ref.make<Browser>(initialBrowser);
    const pageRef = yield* Ref.make<Page>(initialPage);

    initialBrowser.on("disconnected", () => {
      scheduleReconnect(wsEndpoint, browserRef, pageRef, connectedRef, 1);
    });

    return {
      navigate: (
        url: string,
        waitUntil: "load" | "networkidle0" | "networkidle2" = "networkidle0",
      ) =>
        Effect.gen(function* () {
          yield* requireConnected(connectedRef);
          const page = yield* Ref.get(pageRef);
          yield* Effect.tryPromise({
            try: () => page.goto(url, { waitUntil }),
            catch: (e) => new NavigationError({ url, cause: e }),
          });
          return yield* wrapPuppeteer("extractPageContent", () => extractPageContent(page));
        }),

      getContent: (selector?: string) =>
        Effect.gen(function* () {
          yield* requireConnected(connectedRef);
          const page = yield* Ref.get(pageRef);
          yield* requireNavigated(page);
          return yield* wrapPuppeteer("getContent", () => extractPageContent(page, selector));
        }),

      getHtml: (selector?: string) =>
        Effect.gen(function* () {
          yield* requireConnected(connectedRef);
          const page = yield* Ref.get(pageRef);
          yield* requireNavigated(page);
          return yield* wrapPuppeteer("getHtml", async () => {
            const html = await page.evaluate((sel) => {
              const el = sel ? document.querySelector(sel) : document.body;
              return (el as HTMLElement)?.outerHTML?.slice(0, 20000) ?? "";
            }, selector ?? null);
            return { html };
          });
        }),

      waitForSelector: (selector: string, timeout?: number) =>
        Effect.gen(function* () {
          yield* requireConnected(connectedRef);
          const page = yield* Ref.get(pageRef);
          yield* requireNavigated(page);
          yield* wrapPuppeteer(`waitForSelector selector=${selector}`, async () => {
            await page.waitForSelector(selector, { timeout: timeout ?? 5000 });
          });
        }),

      click: (selector: string) =>
        Effect.gen(function* () {
          yield* requireConnected(connectedRef);
          const page = yield* Ref.get(pageRef);
          yield* requireNavigated(page);
          yield* wrapPuppeteer(`click selector=${selector}`, async () => {
            await page.click(selector);
          });
        }),

      fill: (selector: string, value: string) =>
        Effect.gen(function* () {
          yield* requireConnected(connectedRef);
          const page = yield* Ref.get(pageRef);
          yield* requireNavigated(page);
          yield* wrapPuppeteer(`fill selector=${selector}`, async () => {
            await page.click(selector, { clickCount: 3 });
            await page.type(selector, value);
          });
        }),

      screenshot: (): Effect.Effect<
        string,
        LightpandaError | ConnectionLostError | ScreenshotNotSupportedError
      > =>
        Effect.gen(function* () {
          yield* requireConnected(connectedRef);
          const page = yield* Ref.get(pageRef);
          yield* requireNavigated(page);
          // Page.captureScreenshot is not implemented in Lightpanda.
          // See: https://github.com/lightpanda-io/browser/issues/492
          return yield* Effect.fail(
            new ScreenshotNotSupportedError({
              message:
                "Screenshots are not supported by Lightpanda. The CDP Page.captureScreenshot command has not been implemented yet. Track progress at https://github.com/lightpanda-io/browser/issues/492",
            }),
          );
        }),

      evaluate: (expression: string) =>
        Effect.gen(function* () {
          yield* requireConnected(connectedRef);
          const page = yield* Ref.get(pageRef);
          yield* requireNavigated(page);
          return yield* Effect.tryPromise({
            try: async () => {
              const result = await page.evaluate(expression);
              return JSON.stringify(result);
            },
            catch: (e) => new EvalError({ expression, cause: e }),
          });
        }),
    };
  }),
);
