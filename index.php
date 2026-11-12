<?php
require __DIR__ . '/inc/lib.php';
$user = require_login();
$uid = (int)$user['id'];

$today = date('Y-m-d');
$monday = date('Y-m-d', strtotime('monday this week'));
$sunday = date('Y-m-d', strtotime($monday . ' +6 days'));
$week = trained_days($uid, $monday, $sunday);
$monthStart = date('Y-m-01');
$monthDays = trained_days($uid, $monthStart, date('Y-m-t'));
$totalWorkouts = (int)q(
    'SELECT COUNT(*) FROM workouts w WHERE w.user_id = ? AND EXISTS
       (SELECT 1 FROM log_entries l WHERE l.workout_id = w.id AND l.done = 1)', [$uid]
)->fetchColumn();

// Unfinished workout started today (to resume)
$resume = one(
    'SELECT w.id, COALESCE(t.name, w.training_name) n FROM workouts w
       LEFT JOIN trainings t ON t.id = w.training_id
      WHERE w.user_id = ? AND w.workout_date = ? AND w.finished_at IS NULL ORDER BY w.id DESC LIMIT 1',
    [$uid, $today]
);

$exercises = all(
    'SELECT e.id, e.name, e.type, e.target_weight, e.target_duration_min, t.id tid, t.name tname,
            MAX(l.weight) maxw, MAX(l.duration_min) maxd, MAX(w.workout_date) last_date
       FROM exercises e
       JOIN trainings t ON t.id = e.training_id
       LEFT JOIN log_entries l ON l.exercise_id = e.id AND l.done = 1
       LEFT JOIN workouts w ON w.id = l.workout_id
      WHERE e.user_id = ?
      GROUP BY e.id, e.name, e.type, e.target_weight, e.target_duration_min, t.id, t.name, t.sort_order, e.sort_order
      ORDER BY t.sort_order, t.id, e.sort_order, e.id',
    [$uid]
);
$groups = [];
foreach ($exercises as $x) {
    $groups[$x['tname']][] = $x;
}

page_start('Home', [
    'nav' => 'home',
    'right' => '<form method="post" action="logout.php">' . csrf_field()
        . '<button class="iconbtn" aria-label="Log out" title="Log out">' . icon('out') . '</button></form>',
]);
?>
<p class="hello">Hi, <strong><?= e($user['username']) ?></strong> 👋</p>

<?php $trainedToday = isset($week[$today]); ?>
<section class="card today <?= $trainedToday ? 'good' : '' ?>">
  <div class="row between">
    <div>
      <div class="muted small"><?= date('l, j M') ?></div>
      <?php if ($trainedToday): ?>
        <h2 class="ok-text"><?= icon('check') ?> <?= e(implode(' + ', $week[$today])) ?> done</h2>
      <?php else: ?>
        <h2>No training logged yet</h2>
      <?php endif; ?>
    </div>
  </div>
  <?php if ($resume): ?>
    <a class="btn primary block" href="workout.php?id=<?= (int)$resume['id'] ?>">Continue <?= e($resume['n']) ?></a>
  <?php else: ?>
    <a class="btn primary block" href="train.php"><?= $trainedToday ? 'Train again' : 'Choose today\'s training' ?></a>
  <?php endif; ?>
</section>

<section class="card">
  <div class="weekstrip">
    <?php for ($i = 0; $i < 7; $i++):
        $d = date('Y-m-d', strtotime($monday . " +$i days"));
        $st = isset($week[$d]) ? 'done' : ($d < $today && $d >= substr($user['created_at'], 0, 10) ? 'miss' : ($d === $today ? 'now' : 'none')); ?>
      <a href="calendar.php?d=<?= $d ?>" class="wd <?= $st ?>">
        <span><?= date('D', strtotime($d)) ?></span>
        <b><?= $st === 'done' ? icon('check') : ($st === 'miss' ? icon('x') : (int)date('j', strtotime($d))) ?></b>
      </a>
    <?php endfor; ?>
  </div>
  <div class="stats">
    <div><b><?= count($week) ?></b><span>this week</span></div>
    <div><b><?= count($monthDays) ?></b><span>this month</span></div>
    <div><b><?= $totalWorkouts ?></b><span>total</span></div>
  </div>
</section>

<h3 class="section">Exercise summary</h3>
<?php if (!$groups): ?>
  <div class="card empty">
    <p>No exercises yet. Build your routine first: add a training like <em>Push</em>, then add exercises to it.</p>
    <a class="btn primary" href="routine.php">Build routine</a>
  </div>
<?php endif; ?>
<?php foreach ($groups as $tname => $list): ?>
  <h4 class="group"><?= e($tname) ?></h4>
  <div class="list">
  <?php foreach ($list as $x): ?>
    <a class="item" href="timeline.php?id=<?= (int)$x['id'] ?>">
      <div class="grow">
        <div class="title"><?= e($x['name']) ?></div>
        <div class="muted small"><?= $x['last_date'] ? 'Last: ' . date('j M', strtotime($x['last_date'])) : 'Not logged yet' ?></div>
      </div>
      <div class="pr">
        <?php if ($x['type'] === 'sets'): ?>
          <b><?= $x['maxw'] !== null ? num($x['maxw']) . ' kg' : '–' ?></b><span>max weight</span>
        <?php else: ?>
          <b><?= $x['maxd'] !== null ? num($x['maxd']) . ' min' : '–' ?></b><span>max duration</span>
        <?php endif; ?>
      </div>
      <?= icon('next') ?>
    </a>
  <?php endforeach; ?>
  </div>
<?php endforeach; ?>
<?php page_end();
