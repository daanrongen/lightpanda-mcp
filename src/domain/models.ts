import { Schema } from "effect";

export class Link extends Schema.Class<Link>("Link")({
  text: Schema.String,
  href: Schema.String,
}) {}

export class PageContent extends Schema.Class<PageContent>("PageContent")({
  url: Schema.String,
  title: Schema.String,
  text: Schema.String,
  links: Schema.Array(Link),
  truncated: Schema.Boolean,
}) {}
