(function () {
  'use strict';

  var NBSP = ' ';
  var WA_NUMBER = '77000000000'; // заменить на номер клиента

  var TYPES = {
    cosmetic: { name: 'косметический', price: 18000, daysPerM2: 0.45, minDays: 14 },
    capital: { name: 'капитальный', price: 45000, daysPerM2: 1.0, minDays: 35 },
    design: { name: 'по дизайн-проекту', price: 75000, daysPerM2: 1.35, minDays: 49 }
  };

  function money(n, sep) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep || NBSP);
  }
  function weeksWord(n) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return 'недели';
    return 'недель';
  }

  /* калькулятор */
  var area = document.getElementById('area');
  var areaOut = document.getElementById('area-out');
  var sum = document.getElementById('sum');
  var term = document.getElementById('term');
  var waCalc = document.getElementById('wa-calc');
  var waDock = document.getElementById('wa-dock');

  function update() {
    var m2 = Number(area.value);
    var checked = document.querySelector('input[name=type]:checked');
    var t = TYPES[checked ? checked.value : 'capital'];
    var total = Math.round(m2 * t.price / 50000) * 50000;
    var weeks = Math.ceil(Math.max(t.minDays, m2 * t.daysPerM2) / 7);

    areaOut.textContent = m2 + NBSP + 'м²';
    sum.textContent = 'от' + NBSP + money(total) + NBSP + '₸';
    term.textContent = 'около ' + weeks + NBSP + weeksWord(weeks);
    area.setAttribute('aria-valuetext', m2 + ' квадратных метров');

    var msg = 'Здравствуйте! Нужен ремонт: ' + m2 + ' м², ' + t.name +
      '. Расчёт на сайте: от ' + money(total, ' ') + ' ₸, около ' + weeks + ' ' + weeksWord(weeks) +
      '. Когда можно замер?';
    var href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg);
    waCalc.href = href;
    if (waDock) waDock.href = href;
  }
  if (area) {
    area.addEventListener('input', update);
    document.querySelectorAll('input[name=type]').forEach(function (r) { r.addEventListener('change', update); });
    update();
  }

  /* этап ремонта: подпись и передача значения в 3D-сцену */
  var stage = document.getElementById('stage');
  var range = document.getElementById('stage-range');
  var stageName = document.getElementById('stage-name');
  var stageWeek = document.getElementById('stage-week');
  var STAGES = [
    [0.12, 'Бетонная коробка', 'день 1'],
    [0.46, 'Штукатурка и покраска', 'недели 1–3'],
    [0.63, 'Полы и плинтус', 'недели 4–5'],
    [0.97, 'Мебель и свет', 'недели 6–7'],
    [2, 'Готовая комната', 'неделя 8']
  ];
  function setStage(p) {
    for (var i = 0; i < STAGES.length; i++) {
      if (p <= STAGES[i][0]) {
        stageName.textContent = STAGES[i][1];
        stageWeek.textContent = STAGES[i][2];
        break;
      }
    }
    document.dispatchEvent(new CustomEvent('room:stage', { detail: { p: p } }));
  }
  if (range) {
    var playing = null;
    range.addEventListener('input', function () {
      if (playing) { cancelAnimationFrame(playing); playing = null; }
      setStage(Number(range.value) / 100);
    });
    // 3D загрузилось: показываем ползунок и один раз проигрываем ремонт от бетона до готового
    document.addEventListener('room:ready', function () {
      stage.hidden = false;
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { setStage(1); return; }
      var start = null, DUR = 5200;
      function tick(ts) {
        if (start === null) start = ts + 400;
        var k = Math.min(1, Math.max(0, (ts - start) / DUR));
        range.value = Math.round(k * 100);
        setStage(k);
        playing = k < 1 ? requestAnimationFrame(tick) : null;
      }
      // проигрываем, когда комната реально видна на экране; до этого она остаётся готовой
      var seen = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        seen.disconnect();
        playing = requestAnimationFrame(tick);
      }, { threshold: 0.6 });
      seen.observe(document.getElementById('room-view'));
    });
  }

  /* маска телефона +7 */
  var tel = document.getElementById('f-tel');
  function formatTel(value) {
    var d = value.replace(/\D/g, '');
    if (d.charAt(0) === '8' || d.charAt(0) === '7') d = d.slice(1);
    d = d.slice(0, 10);
    var s = '+7';
    if (d.length > 0) s += ' (' + d.slice(0, 3);
    if (d.length >= 3) s += ')';
    if (d.length > 3) s += ' ' + d.slice(3, 6);
    if (d.length > 6) s += '-' + d.slice(6, 8);
    if (d.length > 8) s += '-' + d.slice(8, 10);
    return { text: s, digits: d.length };
  }
  if (tel) {
    tel.addEventListener('focus', function () { if (!tel.value) tel.value = '+7 ('; });
    tel.addEventListener('input', function () { tel.value = formatTel(tel.value).text; });
    tel.addEventListener('blur', function () { if (formatTel(tel.value).digits === 0) tel.value = ''; });
  }

  /* форма заявки: в демо никуда не отправляется */
  var form = document.getElementById('lead-form');
  var err = document.getElementById('form-error');
  var done = document.getElementById('form-done');
  var started = Date.now();
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      if (form.company.value || Date.now() - started < 2500) return; // ловушка для ботов
      var problem = '';
      if (!form.name.value.trim()) problem = 'Напишите, как к вам обращаться.';
      else if (formatTel(form.tel.value).digits < 10) problem = 'В номере не хватает цифр. Нужно 10 после +7.';
      else if (!form.agree.checked) problem = 'Отметьте согласие на обработку данных, без него не можем принять заявку.';
      if (problem) { err.textContent = problem; err.hidden = false; return; }
      // Здесь подключается отправка в Telegram-бот клиента.
      form.querySelector('button[type=submit]').hidden = true;
      done.hidden = false;
    });
  }
})();
