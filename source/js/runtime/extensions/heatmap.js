const DAY = 86400000;
let nextDetailsId = 0;

function isoDate(date) { return date.toISOString().slice(0, 10); }

export function dateInZone(now, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function calendarYear(today, maxColumns = Infinity) {
  // UTC dates are calendar coordinates; publication dates use the site's timezone.
  const end = new Date(`${today}T00:00:00Z`);
  const year = end.getUTCFullYear() - 1;
  const month = end.getUTCMonth();
  const anniversary = Date.UTC(year, month, Math.min(end.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate()));
  const start = anniversary + DAY;
  const offset = (new Date(start).getUTCDay() + 6) % 7;
  const days = [];
  for (let value = start; value <= end.valueOf(); value += DAY) days.push(isoDate(new Date(value)));
  const yearColumns = Math.ceil((offset + days.length) / 7);
  const columns = Math.min(yearColumns, Math.max(1, Math.floor(maxColumns)));
  const firstDay = Math.max(0, (yearColumns - columns) * 7 - offset);
  return { days: days.slice(firstDay), offset: (offset + firstDay) % 7, columns };
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}

function mountWidget(widget, context) {
  const documentRef = widget.ownerDocument;
  const windowRef = documentRef.defaultView;
  const data = JSON.parse(widget.querySelector('[data-heatmap-data]').textContent);
  const { days: publications, messages, timeZone, classes } = data;
  const totalPosts = Object.values(publications).reduce((total, posts) => total + posts.length, 0);
  const locale = data.locale.replace(/_/g, '-');
  const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
  const number = new Intl.NumberFormat(locale);
  const grid = widget.querySelector('[data-heatmap-grid]');
  const calendarContainer = widget.querySelector('[data-heatmap-calendar]');
  const weekdays = widget.querySelector('[data-heatmap-weekdays]');
  const info = widget.querySelector('[data-heatmap-info]');
  const summary = widget.querySelector('[data-heatmap-summary]');
  const details = widget.querySelector('[data-heatmap-details]');
  const close = widget.querySelector('[data-heatmap-close]');
  const date = widget.querySelector('[data-heatmap-date]');
  const stats = widget.querySelector('[data-heatmap-stats]');
  const posts = widget.querySelector('[data-heatmap-posts]');
  details.id = `heatmap-details-${++nextDetailsId}`;
  summary.textContent = fill(messages.summary, { count: number.format(totalPosts) });
  weekdays.replaceChildren();
  for (let index = 0; index < 7; index++) {
    const label = documentRef.createElement('span');
    label.textContent = weekday.format(new Date(Date.UTC(2024, 0, 1 + index)));
    weekdays.append(label);
  }
  const options = { signal: context.signal };
  let calendar;
  let today;
  let selected;
  let activeCell = null;
  let pinned = false;
  let timer;
  let hideTimer;
  let touch = null;
  let dragged = false;
  let lastWidth = -1;
  const resizeObserver = typeof windowRef.ResizeObserver === 'function'
    ? new windowRef.ResizeObserver(() => {
      if (calendar && calendarContainer.clientWidth !== lastWidth) render();
    })
    : null;
  resizeObserver?.observe(calendarContainer);

  context.onCleanup(() => {
    windowRef.clearTimeout(timer);
    windowRef.clearTimeout(hideTimer);
    resizeObserver?.disconnect();
    hide();
  });

  const articles = day => publications[day] || [];
  const words = day => articles(day).reduce((sum, article) => sum + article.words, 0);
  const cellFor = event => event.target.closest?.('[data-date]');
  const cellForDay = day => grid.querySelector(`[data-date="${day}"]`);

  function focusDay(day) {
    const previous = cellForDay(selected);
    if (previous) previous.tabIndex = -1;
    selected = day;
    cellForDay(day).tabIndex = 0;
  }

  function hide(restoreFocus = false) {
    windowRef.clearTimeout(hideTimer);
    const trigger = activeCell;
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-pressed', 'false');
      delete trigger.dataset.preview;
    }
    pinned = false;
    details.hidden = true;
    summary.hidden = false;
    if (restoreFocus) trigger?.focus({ preventScroll: true });
    activeCell = null;
  }

  function show(day, pin = false) {
    windowRef.clearTimeout(hideTimer);
    if (pinned && !pin) return;
    const cell = cellForDay(day);
    if (!cell) return;
    if (activeCell && activeCell !== cell) {
      activeCell.setAttribute('aria-expanded', 'false');
      activeCell.setAttribute('aria-pressed', 'false');
      delete activeCell.dataset.preview;
    }
    const sameDay = activeCell === cell && !details.hidden;
    activeCell = cell;
    pinned = pin;
    close.hidden = !pinned;
    activeCell.dataset.preview = '';
    activeCell.setAttribute('aria-expanded', 'true');
    activeCell.setAttribute('aria-pressed', String(pinned));
    if (!sameDay) {
      date.textContent = `${day}${day === today ? ' \u00b7 ' + messages.today : ''}`;
      stats.textContent = fill(messages.stats, { count: number.format(articles(day).length), words: number.format(words(day)) });
      details.setAttribute('aria-label', date.textContent);
      posts.replaceChildren();
      if (!articles(day).length) {
        const empty = documentRef.createElement('li');
        empty.className = 'heatmap-details__empty';
        empty.textContent = messages.empty;
        posts.append(empty);
      }
      for (const article of articles(day)) {
        const url = new URL(article.href, documentRef.baseURI);
        if (!['https:', 'http:'].includes(url.protocol)) continue;
        const item = documentRef.createElement('li');
        const link = documentRef.createElement('a');
        link.className = classes.link;
        link.href = article.href;
        link.textContent = article.title;
        item.append(link);
        posts.append(item);
      }
    }
    summary.hidden = true;
    details.hidden = false;
  }

  function scheduleHide() {
    windowRef.clearTimeout(hideTimer);
    if (!pinned) hideTimer = windowRef.setTimeout(() => hide(), 180);
  }

  function render() {
    const nextToday = dateInZone(new Date(), timeZone);
    const width = calendarContainer.clientWidth;
    if (nextToday === today && width === lastWidth) return;
    const style = windowRef.getComputedStyle(widget);
    const gap = parseFloat(style.getPropertyValue('--heatmap-gap'));
    const minimum = parseFloat(style.getPropertyValue('--heatmap-min-cell'));
    const capacity = Math.max(1, Math.floor((width + gap) / (minimum + gap)));
    const nextCalendar = calendarYear(nextToday, capacity);
    lastWidth = width;
    if (nextToday === today && nextCalendar.columns === calendar.columns) return;
    const hadFocus = grid.contains(documentRef.activeElement);
    const openDay = pinned ? activeCell?.dataset.date : null;
    hide();
    today = nextToday;
    calendar = nextCalendar;
    if (!hadFocus || !calendar.days.includes(selected)) selected = today;
    widget.style.setProperty('--heatmap-columns', calendar.columns);
    grid.replaceChildren();
    for (const [index, day] of calendar.days.entries()) {
      const count = articles(day).length;
      const cell = documentRef.createElement('button');
      cell.type = 'button';
      cell.className = classes.cell;
      cell.dataset.date = day;
      cell.dataset.index = index;
      cell.dataset.level = Math.min(4, count);
      const coordinate = calendar.offset + index;
      cell.style.gridColumn = Math.floor(coordinate / 7) + 1;
      cell.style.gridRow = coordinate % 7 + 1;
      cell.tabIndex = day === selected ? 0 : -1;
      cell.setAttribute('aria-label', fill(messages.day, {
        date: fullDate.format(new Date(`${day}T00:00:00Z`)), count: number.format(count), words: number.format(words(day))
      }));
      cell.setAttribute('aria-controls', details.id);
      cell.setAttribute('aria-expanded', 'false');
      cell.setAttribute('aria-pressed', 'false');
      if (day === today) cell.setAttribute('aria-current', 'date');
      grid.append(cell);
    }
    if (hadFocus) cellForDay(selected).focus({ preventScroll: true });
    if (openDay && calendar.days.includes(openDay)) show(openDay, true);
  }

  function tick() {
    render();
    timer = windowRef.setTimeout(tick, 60000 - Date.now() % 60000);
  }

  grid.addEventListener('pointerover', event => {
    const cell = cellFor(event);
    if (cell && event.pointerType !== 'touch') show(cell.dataset.date);
  }, options);
  grid.addEventListener('pointerleave', scheduleHide, options);
  grid.addEventListener('focusout', event => {
    if (!info.contains(event.relatedTarget)) scheduleHide();
  }, options);
  grid.addEventListener('click', event => {
    if (dragged) { dragged = false; return; }
    const cell = cellFor(event);
    if (!cell) return;
    focusDay(cell.dataset.date);
    if (pinned && activeCell === cell) hide();
    else {
      show(cell.dataset.date, true);
      if (event.detail === 0) (posts.querySelector('a') || close).focus({ preventScroll: true });
    }
  }, options);
  grid.addEventListener('keydown', event => {
    const cell = cellFor(event);
    if (!cell) return;
    const deltas = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
    let index = Number(cell.dataset.index);
    if (Object.hasOwn(deltas, event.key)) index += deltas[event.key];
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = calendar.days.length - 1;
    else return;
    event.preventDefault();
    index = Math.max(0, Math.min(calendar.days.length - 1, index));
    focusDay(calendar.days[index]);
    const target = grid.children[index];
    target.focus({ preventScroll: true });
    show(calendar.days[index], pinned);
  }, options);

  function cellAt(event) {
    const cell = documentRef.elementFromPoint(event.clientX, event.clientY)?.closest('[data-date]');
    return cell && grid.contains(cell) ? cell.dataset.date : activeCell?.dataset.date || selected;
  }

  grid.addEventListener('pointerdown', event => {
    dragged = false;
    if (event.pointerType === 'touch') {
      touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }
  }, options);
  grid.addEventListener('pointermove', event => {
    if (!touch || event.pointerId !== touch.id) return;
    const dx = Math.abs(event.clientX - touch.x);
    const dy = Math.abs(event.clientY - touch.y);
    if (!dragged && (dx < 6 || dx <= dy)) return;
    dragged = true;
    grid.setPointerCapture(event.pointerId);
    show(cellAt(event), true);
  }, options);
  grid.addEventListener('pointerup', event => {
    if (touch && event.pointerId === touch.id && dragged) { focusDay(cellAt(event)); show(selected, true); }
    touch = null;
  }, options);
  grid.addEventListener('pointercancel', () => { touch = null; dragged = false; }, options);
  close.addEventListener('click', () => hide(true), options);
  info.addEventListener('pointerenter', () => windowRef.clearTimeout(hideTimer), options);
  info.addEventListener('pointerleave', scheduleHide, options);
  info.addEventListener('focusin', () => windowRef.clearTimeout(hideTimer), options);
  info.addEventListener('focusout', event => {
    if (!info.contains(event.relatedTarget)) scheduleHide();
  }, options);
  documentRef.addEventListener('pointerdown', event => {
    if (!grid.contains(event.target) && !info.contains(event.target)) hide();
  }, options);
  documentRef.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !details.hidden) {
      event.preventDefault();
      event.stopPropagation();
      hide(info.contains(documentRef.activeElement));
    }
  }, { ...options, capture: true });
  windowRef.addEventListener('resize', render, options);
  documentRef.addEventListener('visibilitychange', render, options);
  windowRef.addEventListener('focus', render, options);
  windowRef.addEventListener('pageshow', render, options);
  tick();
}

export function mount(root, context) {
  const widgets = [...(root.matches?.('[data-heatmap]') ? [root] : []), ...root.querySelectorAll('[data-heatmap]')];
  for (const widget of widgets) mountWidget(widget, context);
}
