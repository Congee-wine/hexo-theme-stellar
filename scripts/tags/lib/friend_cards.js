/**
 * Standalone friend-card tag.
 * Usage: {% friend_cards friend_cards %}
 */

'use strict'

module.exports = ctx => function(args) {
  const group = args[0]
  const links = ctx.locals.get('data').links || ctx.theme.config.links || ctx.config.theme_config?.links || {}
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char])

  let el = '<div class="friend-cards">'
  for (const item of (links[group] || [])) {
    if (!item?.url || !(item.owner || item.site)) continue

    const color = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(item.color || '') ? item.color : '#7aa7f7'
    const owner = item.owner || item.site
    const site = item.site || item.owner
    const image = item.image || ctx.theme.config.default.avatar

    el += `<article class="friend-card" style="--friend-card-color:${escapeHTML(color)}">`
    el += `<a class="friend-card-link" href="${escapeHTML(item.url)}" target="_blank" rel="external nofollow noopener noreferrer">`
    el += '<div class="friend-card-shell">'
    el += '<div class="friend-card-banner"></div>'
    el += '<div class="friend-card-content">'
    el += `<img class="friend-card-avatar" src="${escapeHTML(image)}" alt="${escapeHTML(owner)}" loading="lazy">`
    el += `<strong class="friend-card-owner">${escapeHTML(owner)}</strong>`
    el += `<span class="friend-card-site">${escapeHTML(site)}</span>`
    el += `<span class="friend-card-desc">${escapeHTML(item.desc || '')}</span>`
    el += '</div></div></a></article>'
  }
  el += '</div>'
  return el
}
