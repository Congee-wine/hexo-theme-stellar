'use strict';

const { escapeHTML } = require('hexo-util');
const { composeUiClasses } = require('../../lib/ui-capabilities');

module.exports = (ctx, links) => {
  const escape = value => escapeHTML(String(value ?? ''));
  let html = '<div class="tag-plugin friend-cards" data-skin="polaroid">';
  for (const item of links) {
    if (!item?.url || !item.title || !/^(https?:\/\/|\/[^/])/i.test(item.url)) continue;
    const color = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(item.color || '') ? item.color : '#7aa7f7';
    html += `<article class="friend-card" style="--friend-card-color:${color}">`;
    html += `<a class="${composeUiClasses('friend-card-link', 'hoverCard')}" href="${escape(item.url)}" target="_blank" rel="external nofollow noopener noreferrer">`;
    html += '<div class="friend-card-shell"><div class="friend-card-banner"></div><div class="friend-card-content">';
    html += `<img class="friend-card-avatar" src="${escape(item.avatar || ctx.stellar.config.fallbacks.avatar)}" alt="${escape(item.title)}" loading="lazy">`;
    html += `<strong class="friend-card-owner">${escape(item.title)}</strong>`;
    html += `<span class="friend-card-site">${escape(item.site || '')}</span>`;
    html += `<span class="friend-card-desc">${escape(item.description || '')}</span>`;
    html += '</div></div></a></article>';
  }
  return html + '</div>';
};
