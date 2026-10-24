/* global hexo */
'use strict';

const { buildCategoryTree } = require('../lib/category_tree');

hexo.extend.helper.register('category_article_entries', function(page) {
  const selected = page.categories ? page.categories.toArray() : [];
  if (!selected.length) return [];
  const categories = this.site.categories.toArray();
  const byId = new Map(categories.map(category => [String(category._id), category]));
  const activeIds = new Set(selected.map(category => String(category._id)));
  const rootIds = new Set();
  for (let category of selected) {
    const visited = new Set();
    while (category.parent && !visited.has(String(category._id))) {
      visited.add(String(category._id));
      const parent = byId.get(String(category.parent));
      if (!parent) break;
      category = parent;
    }
    rootIds.add(String(category._id));
  }
  const entries = [];
  function visit(node, depth) {
    const category = byId.get(String(node._id));
    entries.push({href: node.path, title: node.name, icon: 'default:category', meta: String(node.count),
      depth, active: activeIds.has(String(node._id)), indicator: false, className: 'category-tree__category'});
    const descendantIds = new Set();
    function collect(child) {
      descendantIds.add(String(child._id));
      child.children.forEach(collect);
    }
    node.children.forEach(collect);
    // Hexo associates a nested post with its ancestors; list it only at its deepest category.
    category.posts.toArray().filter(post => !post.categories.toArray().some(value => descendantIds.has(String(value._id))))
      .sort((a, b) => b.date.valueOf() - a.date.valueOf()).forEach(post => {
        entries.push({href: post.path, title: post.title, depth: depth + 1,
          active: post._id === page._id, className: 'category-tree__article'});
      });
    node.children.sort((a, b) => a.name.localeCompare(b.name)).forEach(child => visit(child, depth + 1));
  }
  buildCategoryTree(categories).filter(root => rootIds.has(String(root._id)))
    .sort((a, b) => a.name.localeCompare(b.name)).forEach(root => visit(root, 0));
  return entries.map(entry => ({...entry, href: this.pretty_url(entry.href)}));
});
