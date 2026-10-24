'use strict';

module.exports = ctx => function(args, content) {
  args = ctx.args.map(args, ['skin']);
  const skin = args.skin === 'plain' ? 'plain' : 'inset';
  const body = ctx.render.renderSync({text: content, engine: 'markdown'});
  return `<div class="tag-plugin intro" data-skin="${skin}">${body}</div>`;
};
