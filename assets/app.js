(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Confirm dialogs on destructive forms
  document.addEventListener('submit', function (e) {
    var m = e.target.getAttribute && e.target.getAttribute('data-confirm');
    if (m && !window.confirm(m)) e.preventDefault();
  });

  // Show/hide password
  $$('[data-toggle-pw]').forEach(function (b) {
    b.addEventListener('click', function () {
      var i = b.parentNode.querySelector('input');
      var show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      b.textContent = show ? 'Hide' : 'Show';
    });
  });

  /* ---------- exercise form ---------- */
  var exform = $('#exform');
  if (exform) {
    var list = $('#setlist');
    var syncType = function () {
      var t = $('input[name=type]:checked', exform).value;
      $$('[data-show]', exform).forEach(function (el) { el.hidden = el.getAttribute('data-show') !== t; });
    };
    var totals = function () {
      var rows = $$('.setdef', list), reps = 0, n = 0;
      rows.forEach(function (r) {
        var v = parseInt($('input', r).value, 10);
        if (v > 0) { n++; reps += v; }
      });
      $('#totals').textContent = 'Total: ' + n + ' sets, ' + reps + ' reps';
    };
    var reindex = function () {
      $$('.setdef', list).forEach(function (r, i) {
        $('.setno', r).textContent = i + 1;
        $$('input', r).forEach(function (inp) {
          inp.name = inp.name.replace(/sets\[\d+\]/, 'sets[' + i + ']');
        });
      });
      totals();
    };
    $$('input[name=type]', exform).forEach(function (r) { r.addEventListener('change', syncType); });
    list.addEventListener('input', totals);
    $('[data-add-def]').addEventListener('click', function () {
      var rows = $$('.setdef', list);
      var c = rows[rows.length - 1].cloneNode(true);
      list.appendChild(c);
      reindex();
    });
    $('[data-del-def]').addEventListener('click', function () {
      var rows = $$('.setdef', list);
      if (rows.length > 1) { list.removeChild(rows[rows.length - 1]); reindex(); }
    });
    syncType();
    totals();
  }

  /* ---------- workout logging ---------- */
  var wform = $('#wform');
  if (wform) {
    var progress = function () {
      var all = $$('.chk input', wform), done = all.filter(function (c) { return c.checked; }).length;
      var pct = all.length ? Math.round(done * 100 / all.length) : 0;
      var bar = $('#pbar'); if (bar) bar.style.width = pct + '%';
      var t = $('#ptext'); if (t) t.textContent = done + ' of ' + all.length + ' done';
    };
    wform.addEventListener('change', function (e) {
      if (e.target.type === 'checkbox') progress();
    });
    // Auto tick when a set has both values filled and user leaves the row
    $$('[data-ex]', wform).forEach(function (ex) {
      var box = $('[data-sets]', ex);
      var add = $('[data-add-set]', ex), rm = $('[data-rm-set]', ex);
      if (add) add.addEventListener('click', function () {
        var rows = $$('[data-row]', box);
        var c = rows[rows.length - 1].cloneNode(true);
        var i = rows.length;
        $('.setno', c).textContent = i + 1;
        $$('input', c).forEach(function (inp) {
          inp.name = inp.name.replace(/\]\[\d+\]\[/, '][' + i + '][');
          if (inp.type === 'checkbox') inp.checked = false;
        });
        box.appendChild(c);
        progress();
      });
      if (rm) rm.addEventListener('click', function () {
        var rows = $$('[data-row]', box);
        if (rows.length > 1) { box.removeChild(rows[rows.length - 1]); progress(); }
      });
    });
    progress();
  }

  /* ---------- timeline chart ---------- */
  var chartEl = $('#chart'), dataEl = $('#chartdata');
  if (chartEl && dataEl) {
    var data = JSON.parse(dataEl.textContent);
    var unit = chartEl.getAttribute('data-unit');
    var units = { weight: 'kg', reps: 'reps', volume: 'kg', duration: 'min' };
    var NS = 'http://www.w3.org/2000/svg';
    var fmt = function (v) { return (Math.round(v * 10) / 10).toString(); };
    var shortDate = function (s) {
      var d = new Date(s + 'T00:00:00');
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    };
    var draw = function (metric) {
      var W = 320, H = 170, L = 34, R = 12, T = 14, B = 26;
      var vals = data.map(function (p) { return +p[metric]; });
      var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
      if (max === min) { max = max + 1; min = Math.max(0, min - 1); }
      var pad = (max - min) * 0.15; max += pad; min = Math.max(0, min - pad);
      var x = function (i) { return data.length === 1 ? (L + (W - L - R) / 2) : L + i * (W - L - R) / (data.length - 1); };
      var y = function (v) { return T + (H - T - B) * (1 - (v - min) / (max - min)); };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Progress chart" class="chartsvg">';
      for (var g = 0; g < 4; g++) {
        var gv = min + (max - min) * g / 3, gy = y(gv);
        s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '" class="grid"/>'
          + '<text x="' + (L - 5) + '" y="' + (gy + 3) + '" text-anchor="end" class="ax">' + fmt(gv) + '</text>';
      }
      var pts = vals.map(function (v, i) { return x(i) + ',' + y(v); }).join(' ');
      if (data.length > 1) s += '<polyline points="' + pts + '" class="line"/>';
      vals.forEach(function (v, i) {
        s += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="4" class="pt"><title>' + shortDate(data[i].d) + ': ' + fmt(v) + ' ' + units[metric] + '</title></circle>';
      });
      s += '<text x="' + L + '" y="' + (H - 6) + '" class="ax">' + shortDate(data[0].d) + '</text>';
      if (data.length > 1) s += '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end" class="ax">' + shortDate(data[data.length - 1].d) + '</text>';
      chartEl.innerHTML = s + '</svg>';
    };
    draw(chartEl.getAttribute('data-default'));
    $$('[data-metric] input').forEach(function (r) {
      r.addEventListener('change', function () { draw(r.value); });
    });
  }
})();
