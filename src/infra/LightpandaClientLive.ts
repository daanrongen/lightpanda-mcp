import { Effect, Layer } from "effect";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { LightpandaConfig } from "../config.ts";
// biome-ignore lint/suspicious/noShadowRestrictedNames: EvalError is the correct domain name for this error type
import { EvalError, LightpandaError, NavigationError } from "../domain/errors.ts";
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

const MAX_TEXT_CHARS = 8000;
const MAX_LINKS = 50;

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

export const LightpandaClientLive = Layer.scoped(
  LightpandaClient,
  Effect.gen(function* () {
    const wsEndpoint = yield* Effect.orDie(LightpandaConfig);

    const browser: Browser = yield* Effect.acquireRelease(
      wrapPuppeteer("connect", () => puppeteer.connect({ browserWSEndpoint: wsEndpoint })),
      (b) => Effect.promise(() => b.disconnect()),
    );

    const page: Page = yield* wrapPuppeteer("newPage", () => browser.newPage());

    return {
      navigate: (
        url: string,
        waitUntil: "load" | "networkidle0" | "networkidle2" = "networkidle0",
      ) =>
        Effect.gen(function* () {
          yield* Effect.tryPromise({
            try: () => page.goto(url, { waitUntil }),
            catch: (e) => new NavigationError({ url, cause: e }),
          });
          return yield* wrapPuppeteer("extractPageContent", () => extractPageContent(page));
        }),

      getContent: (selector?: string) =>
        Effect.gen(function* () {
          yield* requireNavigated(page);
          return yield* wrapPuppeteer("getContent", () => extractPageContent(page, selector));
        }),

      getHtml: (selector?: string) =>
        Effect.gen(function* () {
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
          yield* requireNavigated(page);
          yield* wrapPuppeteer(`waitForSelector selector=${selector}`, async () => {
            await page.waitForSelector(selector, { timeout: timeout ?? 5000 });
          });
        }),

      click: (selector: string) =>
        Effect.gen(function* () {
          yield* requireNavigated(page);
          yield* wrapPuppeteer(`click selector=${selector}`, async () => {
            await page.click(selector);
          });
        }),

      fill: (selector: string, value: string) =>
        Effect.gen(function* () {
          yield* requireNavigated(page);
          yield* wrapPuppeteer(`fill selector=${selector}`, async () => {
            await page.click(selector, { clickCount: 3 });
            await page.type(selector, value);
          });
        }),

      screenshot: () =>
        Effect.gen(function* () {
          yield* requireNavigated(page);
          return yield* wrapPuppeteer("screenshot", async () => {
            const buf = await page.screenshot({ encoding: "base64" });
            return typeof buf === "string" ? buf : Buffer.from(buf).toString("base64");
          });
        }),

      evaluate: (expression: string) =>
        Effect.gen(function* () {
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
