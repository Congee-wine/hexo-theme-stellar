const selector = '.menu [data-tooltip]';

export function mount(root, context) {
  const documentRef = root.ownerDocument || root;
  const windowRef = documentRef.defaultView;
  const tooltip = documentRef.createElement('div');
  tooltip.className = 'menu-tooltip';
  tooltip.setAttribute('aria-hidden', 'true');
  tooltip.hidden = true;
  const usePopover = typeof tooltip.showPopover === 'function';
  if (usePopover) tooltip.setAttribute('popover', 'manual');
  documentRef.body.appendChild(tooltip);
  let active = null;
  let animation = null;

  function cancelAnimation() {
    if (animation) {
      animation.onfinish = null;
      animation.cancel();
    }
    animation = null;
  }

  context.onCleanup(() => {
    cancelAnimation();
    tooltip.remove();
  });

  function animate(from, to, finish = () => {}) {
    cancelAnimation();
    if (windowRef.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    animation = tooltip.animate([from, to], {
      duration: 160,
      easing: 'ease-out',
      fill: 'forwards'
    });
    animation.onfinish = () => {
      cancelAnimation();
      finish();
    };
  }

  function hide() {
    if (!active) return;
    active = null;
    const style = windowRef.getComputedStyle(tooltip);
    const from = { opacity: style.opacity, transform: style.transform };
    animate(from, { opacity: 0, transform: 'translateY(4px)' }, () => {
      if (usePopover && tooltip.matches(':popover-open')) tooltip.hidePopover();
      tooltip.hidden = true;
    });
  }

  function show(trigger) {
    if (!trigger?.dataset.tooltip || trigger === active) return;
    cancelAnimation();
    active = trigger;
    tooltip.textContent = trigger.dataset.tooltip;
    tooltip.hidden = false;
    tooltip.style.visibility = 'hidden';
    // The top layer escapes the sidebar's scroll clipping and fading mask.
    if (usePopover && !tooltip.matches(':popover-open')) tooltip.showPopover();
    const anchor = trigger.getBoundingClientRect();
    const bounds = tooltip.getBoundingClientRect();
    const viewportWidth = documentRef.documentElement.clientWidth;
    const viewportHeight = documentRef.documentElement.clientHeight;
    const left = Math.max(8, Math.min(anchor.left + (anchor.width - bounds.width) / 2,
      viewportWidth - bounds.width - 8));
    const above = anchor.top - bounds.height - 10;
    const top = above >= 8 ? above : Math.max(8,
      Math.min(anchor.bottom + 10, viewportHeight - bounds.height - 8));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.visibility = 'visible';
    // Each menu item gets a fresh entrance, even during the previous fade-out.
    animate({ opacity: 0, transform: 'translateY(4px)' },
      { opacity: 1, transform: 'translateY(0)' });
  }

  function triggerFor(event) {
    const trigger = event.target.closest?.(selector);
    return trigger && root.contains(trigger) ? trigger : null;
  }

  const options = { signal: context.signal };
  root.addEventListener('pointerover', event => {
    const trigger = triggerFor(event);
    if (event.pointerType !== 'touch' && trigger && !trigger.contains(event.relatedTarget)) show(trigger);
  }, options);
  root.addEventListener('pointerout', event => {
    const trigger = triggerFor(event);
    if (trigger && trigger === active && !trigger.contains(event.relatedTarget) && !trigger.matches(':focus-visible')) hide();
  }, options);
  root.addEventListener('focusin', event => {
    const trigger = triggerFor(event);
    if (trigger?.matches(':focus-visible')) show(trigger);
  }, options);
  root.addEventListener('focusout', event => {
    if (active && triggerFor(event) === active && !active.matches(':hover')) hide();
  }, options);
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') hide();
  }, options);
  windowRef.addEventListener('scroll', hide, { ...options, capture: true });
  windowRef.addEventListener('resize', hide, options);
}
