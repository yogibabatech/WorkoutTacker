<?php
require __DIR__ . '/inc/lib.php';
$user = require_login();
$uid = (int)$user['id'];

$x = own_exercise($uid, (int)($_GET['id'] ?? 0));
if (!$x) {
    redirect('index.php');
}
$isSets = $x['type'] === 'sets';

$rows = all(
    'SELECT w.id wid, w.workout_date d, l.set_no, l.weight, l.reps, l.duration_min
       FROM log_entries l JOIN workouts w ON w.id = l.workout_id
      WHERE l.exercise_id = ? AND l.done = 1 AND w.user_id = ?
      ORDER BY w.workout_date, w.id, l.set_no', [$x['id'], $uid]
);
$sessions = [];
foreach ($rows as $r) {
    $k = $r['wid'];
    $s = &$sessions[$k];
    $s = $s ?? ['date' => $r['d'], 'sets' => [], 'maxw' => 0.0, 'reps' => 0, 'vol' => 0.0, 'dur' => 0.0];
    $s['sets'][] = $r;
    $s['maxw'] = max($s['maxw'], (float)$r['weight']);
    $s['reps'] += (int)$r['reps'];
    $s['vol'] += (float)$r['weight'] * (int)$r['reps'];
    $s['dur'] += (float)$r['duration_min'];
    unset($s);
}
$sessions = array_values($sessions);

$bestW = $sessions ? max(array_column($sessions, 'maxw')) : 0;
$bestD = $sessions ? max(array_column($sessions, 'dur')) : 0;
$bestV = $sessions ? max(array_column($sessions, 'vol')) : 0;

$chart = array_map(fn($s) => [
    'd' => $s['date'], 'weight' => $s['maxw'], 'reps' => $s['reps'], 'volume' => round($s['vol'], 1), 'duration' => $s['dur'],
], $sessions);

page_start($x['name'], ['nav' => 'home', 'back' => 'index.php', 'right' => '<a class="iconbtn" href="exercise.php?id=' . (int)$x['id'] . '" aria-label="Edit">' . icon('edit') . '</a>']);
?>
<?php if ($x['description']): ?><p class="muted"><?= nl2br(e($x['description'])) ?></p><?php endif; ?>

<div class="card stats">
  <?php if ($isSets): ?>
    <div><b><?= $sessions ? num($bestW) : '–' ?></b><span>max kg</span></div>
    <div><b><?= $sessions ? num($bestV) : '–' ?></b><span>best volume</span></div>
    <div><b><?= count($sessions) ?></b><span>sessions</span></div>
  <?php else: ?>
    <div><b><?= $sessions ? num($bestD) : '–' ?></b><span>max min</span></div>
    <div><b><?= $x['target_duration_min'] ?: '–' ?></b><span>target min</span></div>
    <div><b><?= count($sessions) ?></b><span>sessions</span></div>
  <?php endif; ?>
</div>

<?php if (!$sessions): ?>
  <div class="card empty"><p>Nothing logged for this exercise yet. Tick sets as done in a workout and they show up here.</p>
    <a class="btn primary" href="train.php">Start training</a></div>
<?php else: ?>
  <div class="card">
    <?php if ($isSets): ?>
      <div class="seg small" data-metric>
        <label><input type="radio" name="metric" value="weight" checked><span>Weight</span></label>
        <label><input type="radio" name="metric" value="reps"><span>Reps</span></label>
        <label><input type="radio" name="metric" value="volume"><span>Volume</span></label>
      </div>
    <?php endif; ?>
    <div id="chart" data-default="<?= $isSets ? 'weight' : 'duration' ?>" data-unit="<?= $isSets ? 'kg' : 'min' ?>"></div>
    <script type="application/json" id="chartdata"><?= json_encode($chart, JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
  </div>

  <h3 class="section">Timeline</h3>
  <div class="timeline">
  <?php foreach (array_reverse($sessions) as $s): ?>
    <div class="tl">
      <i></i>
      <div class="card">
        <div class="row between">
          <b><?= e(date('D, j M Y', strtotime($s['date']))) ?></b>
          <span class="pill"><?= $isSets ? num($s['maxw']) . ' kg max' : num($s['dur']) . ' min' ?></span>
        </div>
        <?php if ($isSets): ?>
          <div class="chips">
            <?php foreach ($s['sets'] as $st): ?><span class="chip"><?= num($st['weight']) ?> × <?= (int)$st['reps'] ?></span><?php endforeach; ?>
          </div>
          <div class="muted small"><?= count($s['sets']) ?> sets · <?= $s['reps'] ?> reps · volume <?= num($s['vol']) ?> kg</div>
        <?php endif; ?>
      </div>
    </div>
  <?php endforeach; ?>
  </div>
<?php endif; ?>
<?php page_end();
