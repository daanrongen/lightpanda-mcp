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

const extractPageContent = async (page: Page, selector?: string): Promise<PageContent> => {
  const url = page.url();
  const title = await page.title();
  const { text, links } = await page.evaluate((sel) => {
    const root = sel ? document.querySelector(sel) : document.body;
    const el = root ?? document.body;
    const rawText = (el as HTMLElement).innerText ?? "";
    const rawLinks = [...el.querySelectorAll("a")].map((a) => ({
      text: (a as HTMLAnchorElement).innerText.trim().slice(0, 200),
      href: (a as HTMLAnchorElement).href,
    }));
    return { text: rawText.slice(0, 8000), links: rawLinks.slice(0, 50) };
  }, selector ?? null);
  return new PageContent({
    url,
    title,
    text,
    links: links.map((l) => new Link(l)),
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
        wrapPuppeteer("getContent", () => extractPageContent(page, selector)),

      click: (selector: string) =>
        wrapPuppeteer(`click selector=${selector}`, async () => {
          await page.click(selector);
        }),

      fill: (selector: string, value: string) =>
        wrapPuppeteer(`fill selector=${selector}`, async () => {
          await page.click(selector, { clickCount: 3 });
          await page.type(selector, value);
        }),

      screenshot: () =>
        wrapPuppeteer("screenshot", async () => {
          const buf = await page.screenshot({ encoding: "base64" });
          return typeof buf === "string" ? buf : Buffer.from(buf).toString("base64");
        }),

      evaluate: (expression: string) =>
        Effect.tryPromise({
          try: async () => {
            const result = await page.evaluate(expression);
            return JSON.stringify(result);
          },
          catch: (e) => new EvalError({ expression, cause: e }),
        }),
    };
  }),
);
