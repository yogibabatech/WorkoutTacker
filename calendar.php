<?php
require __DIR__ . '/inc/lib.php';
$user = require_login();
$uid = (int)$user['id'];
$today = date('Y-m-d');
$since = substr($user['created_at'], 0, 10);

$sel = (string)($_GET['d'] ?? '');
if (!valid_date($sel)) {
    $sel = '';
}
$ym = (string)($_GET['m'] ?? ($sel !== '' ? substr($sel, 0, 7) : date('Y-m')));
if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $ym)) {
    $ym = date('Y-m');
}
$first = $ym . '-01';
$daysIn = (int)date('t', strtotime($first));
$offset = (int)date('N', strtotime($first)) - 1; // Monday first
$prev = date('Y-m', strtotime($first . ' -1 month'));
$next = date('Y-m', strtotime($first . ' +1 month'));
$trained = trained_days($uid, $first, $ym . '-' . $daysIn);

page_start('Calendar', ['nav' => 'calendar']);
?>
<div class="monthbar">
  <a class="iconbtn" href="?m=<?= $prev ?>" aria-label="Previous month"><?= icon('back') ?></a>
  <strong><?= date('F Y', strtotime($first)) ?></strong>
  <a class="iconbtn" href="?m=<?= $next ?>" aria-label="Next month"><?= icon('next') ?></a>
</div>

<div class="cal card">
  <?php foreach (['M', 'T', 'W', 'T', 'F', 'S', 'S'] as $h): ?><div class="dow"><?= $h ?></div><?php endforeach; ?>
  <?php for ($i = 0; $i < $offset; $i++): ?><div></div><?php endfor; ?>
  <?php for ($d = 1; $d <= $daysIn; $d++):
      $date = sprintf('%s-%02d', $ym, $d);
      $names = $trained[$date] ?? null;
      if ($names) { $cls = 'done'; }
      elseif ($date < $today && $date >= $since) { $cls = 'miss'; }
      else { $cls = 'none'; }
  ?>
    <a href="?m=<?= $ym ?>&d=<?= $date ?>" class="day <?= $cls ?><?= $date === $today ? ' today' : '' ?><?= $date === $sel ? ' sel' : '' ?>">
      <span class="n"><?= $d ?></span>
      <?php if ($cls === 'done'): ?>
        <span class="mark"><?= icon('check') ?></span><span class="nm"><?= e($names[0]) ?><?= count($names) > 1 ? ' +' . (count($names) - 1) : '' ?></span>
      <?php elseif ($cls === 'miss'): ?>
        <span class="mark"><?= icon('x') ?></span><span class="nm">No training</span>
      <?php endif; ?>
    </a>
  <?php endfor; ?>
</div>

<div class="legend small muted">
  <span><i class="dot g"></i> Trained</span><span><i class="dot r"></i> No training</span>
</div>

<?php if ($sel !== ''):
    $ws = all(
        'SELECT w.id, COALESCE(t.name, w.training_name) n FROM workouts w LEFT JOIN trainings t ON t.id = w.training_id
          WHERE w.user_id = ? AND w.workout_date = ? ORDER BY w.id', [$uid, $sel]
    );
    $any = false;
?>
  <h3 class="section"><?= e(date('l, j M Y', strtotime($sel))) ?></h3>
  <?php foreach ($ws as $wk):
      $ents = all('SELECT * FROM log_entries WHERE workout_id = ? AND done = 1 ORDER BY exercise_name, set_no', [$wk['id']]);
      if (!$ents) { continue; }
      $any = true;
      $by = [];
      foreach ($ents as $en) { $by[$en['exercise_name']][] = $en; }
  ?>
    <section class="card">
      <div class="row between"><h3 class="ok-text"><?= icon('check') ?> <?= e($wk['n']) ?></h3>
        <a class="btn small" href="workout.php?id=<?= (int)$wk['id'] ?>">Edit</a></div>
      <?php foreach ($by as $name => $list): ?>
        <div class="logline">
          <b><?= e($name) ?></b>
          <span class="muted">
            <?php if ($list[0]['duration_min'] !== null): echo e(num($list[0]['duration_min'])) . ' min';
            else: echo e(implode(', ', array_map(fn($l) => num($l['weight']) . '×' . $l['reps'], $list))); endif; ?>
          </span>
        </div>
      <?php endforeach; ?>
    </section>
  <?php endforeach; ?>
  <?php if (!$any): ?>
    <div class="card empty">
      <p class="bad-text"><?= icon('x') ?> No training<?= $sel > $today ? ' (future day)' : '' ?></p>
      <?php if ($sel <= $today): ?><a class="btn primary" href="train.php?d=<?= $sel ?>">Log training for this day</a><?php endif; ?>
    </div>
  <?php endif; ?>
<?php endif; ?>
<?php page_end();
