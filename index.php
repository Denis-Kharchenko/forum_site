<?php
require __DIR__ . '/lib/content.php';
$content = load_content();
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Форум работающей молодёжи — 23 октября 2026, Санкт-Петербург</title>
  <meta name="description" content="Форум работающей молодёжи Санкт-Петербурга. 23 октября 2026, 10:00–17:30, творческий кластер «АТС», ул. Некрасова, 7.">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="icon" href="favicon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>

<!-- SVG-символы -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-arrow" viewBox="0 0 48 48"><path d="M8 40 40 8M16 8h24v24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="square"/></symbol>
  <symbol id="i-gear" viewBox="0 0 100 100"><path fill="currentColor" d="M43 2h14l3 13 9 4 11-8 10 10-8 11 4 9 13 3v14l-13 3-4 9 8 11-10 10-11-8-9 4-3 13H43l-3-13-9-4-11 8-10-10 8-11-4-9-13-3V43l13-3 4-9-8-11 10-10 11 8 9-4zM50 32a18 18 0 1 0 0 36 18 18 0 1 0 0-36z"/></symbol>
  <symbol id="i-pin" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></g></symbol>
  <symbol id="i-cal" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M3 10h18M8 3v4M16 3v4"/></g></symbol>
  <symbol id="i-clock" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g></symbol>
  <symbol id="i-phone" viewBox="0 0 24 24"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
  <symbol id="i-mail" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3.5 6 8.5 7 8.5-7"/></g></symbol>
  <symbol id="i-chat" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/><path d="M8 12h.01M12 12h.01M16 12h.01" stroke-width="2.6"/></g></symbol>
  <symbol id="i-person" viewBox="0 0 100 120"><path fill="currentColor" d="M50 12c14 0 24 11 24 26 0 16-10 30-24 30S26 54 26 38c0-15 10-26 24-26zM8 120c2-26 18-42 42-42s40 16 42 42z"/></symbol>
</svg>

<a class="skip" href="#main">Перейти к содержанию</a>

<!-- ============ HEADER ============ -->
<header class="header" id="header">
  <div class="container header__inner">
    <a href="#top" class="logo" aria-label="На главную">
      <span class="logo__mark" aria-hidden="true"><svg><use href="#i-gear"/></svg></span>
      <span class="logo__text">Форум<br>работающей<br>молодёжи</span>
    </a>
    <nav class="nav" id="nav" aria-label="Основная навигация">
      <a href="#about">О форуме</a>
      <a href="#program">Программа</a>
      <a href="#partners">Партнёры</a>
      <a href="#speakers">Спикеры</a>
      <a href="#place">Место</a>
      <a href="#contacts">Контакты</a>
      <a href="#" class="nav__reg js-reg">Регистрация</a>
    </nav>
    <a href="#" class="btn btn--blue header__cta js-reg">Регистрация</a>
    <button class="burger" id="burger" aria-label="Открыть меню" aria-expanded="false" aria-controls="nav"><span></span><span></span><span></span></button>
  </div>
</header>

<main id="main">

<!-- ============ HERO ============ -->
<section class="hero" id="top">
  <div class="hatch hatch--hero" aria-hidden="true"></div>
  <div class="container hero__grid">
    <div class="hero__left">
      <span class="corner corner--tl" aria-hidden="true"></span>
      <p class="hero__eyebrow">Форум<br>работающей<br>молодёжи</p>
      <p class="hero__manifest">Твой голос.<br>Твои идеи.<br>Твоё время.<br>Твоё будущее.</p>
      <div class="hero__meta">
        <div><svg class="ico"><use href="#i-cal"/></svg><span>23 октября 2026</span></div>
        <div><svg class="ico"><use href="#i-clock"/></svg><span>10:00–17:30</span></div>
        <div><svg class="ico"><use href="#i-pin"/></svg><span>«АТС», Некрасова, 7</span></div>
      </div>
    </div>

    <div class="hero__center">
      <h1 class="hero__title">
        <span class="line"><span>Наследие</span></span>
        <span class="line"><span>созидателей</span></span>
      </h1>
      <div class="hero__art">
        <div class="hero__shapes" aria-hidden="true">
          <span class="shape shape--circle"></span>
          <span class="shape shape--bar1"></span>
          <span class="shape shape--bar2"></span>
          <span class="shape shape--dots"></span>
        </div>
        <div class="crop crop--hero" style="--x:360;--y:462;--w:900;--h:382">
          <img src="assets/slide1.jpg" alt="Созидатели прошлого и настоящего: молодой специалист, М. Ломоносов, Пётр I" width="1500" height="844">
        </div>
      </div>
    </div>

    <div class="hero__right">
      <svg class="hero__arrow"><use href="#i-arrow"/></svg>
      <ul class="hero__words">
        <li>Труд</li><li>Творчество</li><li>Движение</li><li>Вперёд</li>
      </ul>
      <div class="countdown" id="countdown" aria-label="До начала форума">
        <p class="countdown__label">До старта</p>
        <div class="countdown__row">
          <div><b data-cd="d">00</b><span>дней</span></div>
          <div><b data-cd="h">00</b><span>часов</span></div>
          <div><b data-cd="m">00</b><span>минут</span></div>
        </div>
      </div>
      <a href="#" class="btn btn--blue btn--lg js-reg">Зарегистрироваться <svg class="ico"><use href="#i-arrow"/></svg></a>
      <p class="hero__motto">Вдохновляемся прошлым —<br>создаём будущее</p>
    </div>
  </div>
</section>

<!-- ============ MARQUEE ============ -->
<div class="marquee" aria-hidden="true">
  <div class="marquee__track">
    <span>Трудись. Создавай. Двигайся вперёд</span><svg><use href="#i-arrow"/></svg>
    <span>23 октября · АТС</span><svg><use href="#i-arrow"/></svg>
    <span>Будь созидателем</span><svg><use href="#i-arrow"/></svg>
    <span>Форум работающей молодёжи</span><svg><use href="#i-arrow"/></svg>
    <span>Трудись. Создавай. Двигайся вперёд</span><svg><use href="#i-arrow"/></svg>
    <span>23 октября · АТС</span><svg><use href="#i-arrow"/></svg>
    <span>Будь созидателем</span><svg><use href="#i-arrow"/></svg>
    <span>Форум работающей молодёжи</span><svg><use href="#i-arrow"/></svg>
  </div>
</div>

<!-- ============ 01. О ФОРУМЕ ============ -->
<section class="section about" id="about">
  <div class="container">
    <div class="sec-head reveal">
      <span class="sec-num">01</span>
      <h2 class="h2 h2--row">О форуме — <em>голос работающей молодёжи</em></h2>
    </div>
    <div class="about__grid">
      <div class="about__text reveal">
        <p class="lead">Форум работающей молодёжи — ежегодная площадка Санкт-Петербурга, которую Центр «Вектор» проводит вместе с Советом работающей молодёжи.</p>
        <p>С 2021 года он собирает молодых специалистов предприятий из разных отраслей, HR-экспертов, представителей власти и студентов колледжей и вузов.</p>
        <p>В 2024 году форум прошёл в Президентской библиотеке и был посвящён благополучию сотрудников — от здоровья и финансов до профессионального роста.</p>
        <p>Каждый год участников ждут пленарные дискуссии, мастер-классы, тренинги, проектные сессии и живой нетворкинг.</p>
        <p>23 октября 2026 года форум соберёт работающую молодёжь в творческом кластере «АТС», чтобы вместе говорить о том, как строить карьеру и менять город к лучшему.</p>
        <a href="#" class="btn btn--blue btn--lg js-reg">Зарегистрироваться <svg class="ico"><use href="#i-arrow"/></svg></a>
      </div>
      <aside class="about__side reveal">
        <div class="crop crop--about" style="--x:1060;--y:140;--w:440;--h:560">
          <img src="assets/slide8.jpg" alt="Молодые специалисты поднимаются по ступеням к зданию" loading="lazy" width="1500" height="844">
        </div>
        <ul class="facts">
          <li><svg class="ico"><use href="#i-cal"/></svg><div><small>Дата</small><b>23 октября 2026</b></div></li>
          <li><svg class="ico"><use href="#i-clock"/></svg><div><small>Время</small><b>10:00–17:30</b></div></li>
          <li><svg class="ico"><use href="#i-pin"/></svg><div><small>Место</small><b>Творческий кластер «АТС»</b></div></li>
        </ul>
      </aside>
    </div>
  </div>
</section>

<!-- ============ 02. ПРОГРАММА ============ -->
<section class="section program" id="program">
  <div class="dots dots--tr" aria-hidden="true"></div>
  <div class="container program__grid">
    <div class="program__art reveal">
      <div class="crop crop--program" style="--x:0;--y:0;--w:580;--h:844">
        <img src="assets/slide5.jpg" alt="Молодые люди поднимаются по синей лестнице" loading="lazy" width="1500" height="844">
      </div>
    </div>
    <div class="program__content">
      <div class="reveal">
        <span class="sec-num">02</span>
        <h2 class="h2">Программа <em>23 октября</em></h2>
        <p class="program__note">Предварительная программа — скоро опубликуем подробности.</p>
      </div>
      <ol class="timeline reveal">
<?php foreach ($content['program'] as $item): ?>
        <li><time><?= e($item['time']) ?></time><div><b><?= e($item['title']) ?></b><?php if ($item['place'] !== ''): ?><span><?= e($item['place']) ?></span><?php endif; ?></div></li>
<?php endforeach; ?>
      </ol>
      <a href="#" class="btn btn--blue btn--lg js-reg reveal">Зарегистрироваться <svg class="ico"><use href="#i-arrow"/></svg></a>
    </div>
  </div>
</section>

<!-- ============ 03. ПАРТНЁРЫ ============ -->
<section class="section partners" id="partners">
  <div class="container">
    <div class="sec-head reveal">
      <span class="sec-num">03</span>
      <h2 class="h2 h2--row">Партнёры <em>форума</em></h2>
      <p class="sec-head__text">Организаторы и компании, которые вместе с нами создают форум.</p>
    </div>
<?php
$visible  = array_values(array_filter($content['partners'], fn($p) => !$p['hidden'] && $p['logo'] !== ''));
$tiers    = [
    'main' => array_values(array_filter($visible, fn($p) => $p['main'])),
    'more' => array_values(array_filter($visible, fn($p) => !$p['main'])),
];
?>
<?php foreach ($tiers as $tier => $list): if (!$list) continue; ?>
    <ul class="partner-grid partner-grid--<?= $tier ?>">
<?php foreach ($list as $i => $p): ?>
      <li class="partner<?= ($tier === 'main' && $i === 0) ? ' partner--wide' : '' ?> reveal" style="--lw:94%;--lh:<?= (int)$p['size'] ?>%"><img<?= $p['invert'] ? ' class="partner__img--invert"' : '' ?> src="<?= e($p['logo']) ?>" alt="<?= e($p['name']) ?>" loading="lazy"></li>
<?php endforeach; ?>
    </ul>
<?php endforeach; ?>
  </div>
</section>

<!-- ============ 04. СПИКЕРЫ ============ -->
<section class="section speakers" id="speakers">
  <div class="container">
    <div class="sec-head reveal">
      <span class="sec-num">04</span>
      <h2 class="h2 h2--row">Спикеры <em>форума</em></h2>
      <p class="sec-head__text">Эксперты, руководители и практики, которые поделятся опытом.</p>
    </div>
    <div class="speaker-grid">
<?php foreach ($content['speakers'] as $s): ?>
      <article class="speaker reveal"><div class="speaker__photo"><?php if ($s['photo'] !== ''): ?><img src="<?= e($s['photo']) ?>" alt="<?= e($s['name']) ?>" loading="lazy"><?php else: ?><svg aria-hidden="true"><use href="#i-person"/></svg><?php endif; ?></div><h3><?= e($s['name']) ?></h3><p><?= e($s['role']) ?></p></article>
<?php endforeach; ?>
    </div>
<?php if ($content['speakers_more']): ?>
    <h3 class="h3 reveal">А также</h3>
    <ul class="speaker-list reveal">
<?php foreach ($content['speakers_more'] as $s): ?>
      <li><b><?= e($s['name']) ?></b><span><?= e($s['role']) ?></span></li>
<?php endforeach; ?>
    </ul>
<?php endif; ?>
  </div>
</section>

<!-- ============ 05. МЕСТО ============ -->
<section class="section place" id="place">
  <div class="container place__grid">
    <div class="place__info reveal">
      <span class="sec-num">05</span>
      <h2 class="h2">Место <em>проведения</em></h2>
      <dl class="place__list">
        <div><dt>Площадка</dt><dd>Творческий кластер «АТС»</dd></div>
        <div><dt>Адрес</dt><dd>Санкт-Петербург, ул. Некрасова, 7</dd></div>
        <div><dt>Дата</dt><dd>23 октября 2026</dd></div>
        <div><dt>Время</dt><dd>10:00–17:30</dd></div>
      </dl>
      <a class="btn btn--ghost" href="https://yandex.ru/maps/?pt=30.351440%2C59.938782&amp;z=17&amp;l=map" target="_blank" rel="noopener">Открыть в Яндекс Картах <svg class="ico"><use href="#i-arrow"/></svg></a>
    </div>
    <div class="place__map reveal">
      <iframe title="Карта: Санкт-Петербург, ул. Некрасова, 7" src="https://yandex.ru/map-widget/v1/?ll=30.351440%2C59.938782&amp;z=17&amp;pt=30.351440%2C59.938782%2Cpm2rdm" loading="lazy" allowfullscreen></iframe>
    </div>
  </div>
</section>

<!-- ============ 06. КОНТАКТЫ ============ -->
<section class="section contacts" id="contacts">
  <div class="container contacts__grid">
    <div class="reveal">
      <span class="sec-num">06</span>
      <h2 class="h2">Контакты</h2>
<?php $c = $content['contacts']; ?>
      <ul class="contact-list">
<?php if ($c['organizer'] !== ''): ?>
        <li><svg class="ico"><use href="#i-chat"/></svg><div><small>Организатор</small><b><?= e($c['organizer']) ?></b></div></li>
<?php endif; ?>
<?php if ($c['phone'] !== ''): ?>
        <li><svg class="ico"><use href="#i-phone"/></svg><div><small>Телефон</small><b><a href="<?= e(tel_href($c['phone'])) ?>"><?= e($c['phone']) ?></a></b></div></li>
<?php endif; ?>
<?php if ($c['email'] !== ''): ?>
        <li><svg class="ico"><use href="#i-mail"/></svg><div><small>Email</small><b><a href="mailto:<?= e($c['email']) ?>"><?= e($c['email']) ?></a></b></div></li>
<?php endif; ?>
<?php if ($c['press'] !== ''): ?>
        <li><svg class="ico"><use href="#i-mail"/></svg><div><small>Для СМИ и партнёров</small><b><a href="mailto:<?= e($c['press']) ?>"><?= e($c['press']) ?></a></b></div></li>
<?php endif; ?>
      </ul>
<?php if ($c['vk'] !== '' || $c['telegram'] !== ''): ?>
      <div class="socials">
<?php if ($c['vk'] !== ''): ?>
        <a class="social" href="<?= e($c['vk']) ?>" target="_blank" rel="noopener">VK</a>
<?php endif; ?>
<?php if ($c['telegram'] !== ''): ?>
        <a class="social" href="<?= e($c['telegram']) ?>" target="_blank" rel="noopener">Telegram</a>
<?php endif; ?>
      </div>
<?php endif; ?>
    </div>
    <div class="cta-card reveal">
      <svg class="cta-card__arrow" aria-hidden="true"><use href="#i-arrow"/></svg>
      <p class="cta-card__title">Будь созидателем&nbsp;— приходи 23&nbsp;октября</p>
      <p class="cta-card__text">Регистрация проходит на платформе Росмолодёжи.</p>
      <a href="#" class="btn btn--white btn--lg js-reg">Зарегистрироваться <svg class="ico"><use href="#i-arrow"/></svg></a>
    </div>
  </div>
</section>

</main>

<footer class="footer">
  <div class="container footer__inner">
    <p class="footer__big">Трудись. Твори. Меняй мир!</p>
    <div class="footer__row">
      <span>© 2026 Форум работающей молодёжи</span>
      <a href="#top">Наверх ↑</a>
    </div>
  </div>
</footer>

<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>

<script src="js/main.js"></script>
</body>
</html>
