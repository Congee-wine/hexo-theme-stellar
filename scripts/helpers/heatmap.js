/* global hexo */
"use strict";

const { countWords } = require("../lib/reading_time");

let cached = null;
hexo.extend.filter.register("before_generate", () => { cached = null; });

hexo.extend.helper.register("heatmap_data", function() {
  if (cached) return cached;
  const timeZone = hexo.config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  });
  const days = {};
  const now = Date.now();
  for (const post of this.site.posts.toArray()) {
    if (post.published === false || post.date.valueOf() > now) continue;
    const listing = this.post_view_model(post).render.listing;
    if (!listing.listed) continue;
    const parts = Object.fromEntries(formatter.formatToParts(post.date.toDate()).map(part => [part.type, part.value]));
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    (days[day] ||= []).push({
      title: listing.title,
      href: this.pretty_url(listing.href),
      words: countWords(post.content || post._content || "")
    });
  }
  // Keep historical dates so an old deployment can still roll its calendar forward.
  cached = { timeZone, days };
  return cached;
});
