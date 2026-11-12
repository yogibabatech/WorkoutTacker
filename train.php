<?php
require __DIR__ . '/inc/lib.php';
$user = require_login();
$uid = (int)$user['id'];
$today = date('Y-m-d');

$date = (string)($_GET['d'] ?? $_POST['date'] ?? $today);
if (!valid_date($date) || $date > $today) {
    $date = $today;
}

if (is_post()) {
    csrf_check();
    $t = own_training($uid, (int)($_POST['training_id'] ?? 0));
    if (!$t) {
        redirect('train.php');
    }
    $w = one('SELECT id FROM workouts WHERE user_id = ? AND training_id = ? AND workout_date = ?', [$uid, $t['id'], $date]);
    if ($w) {
        $wid = (int)$w['id'];
        q('UPDATE workouts SET finished_at = NULL WHERE id = ?', [$wid]);
    } else {
        q('INSERT INTO workouts (user_id, training_id, training_name, workout_date, started_at) VALUES (?,?,?,?,?)',
            [$uid, $t['id'], $t['name'], $date, date('Y-m-d H:i:s')]);
        $wid = (int)db()->lastInsertId();
    }
    redirect('workout.php?id=' . $wid);
}

$trainings = all(
    'SELECT t.*, (SELECT COUNT(*) FROM exercises e WHERE e.training_id = t.id) n,
            (SELECT MAX(w.workout_date) FROM workouts w WHERE w.training_id = t.id
                AND EXISTS (SELECT 1 FROM log_entries l WHERE l.workout_id = w.id AND l.done = 1)) last_date
       FROM trainings t WHERE t.user_id = ? ORDER BY t.sort_order, t.id', [$uid]
);

$isToday = $date === $today;
page_start($isToday ? "Today's training" : 'Log a past day', ['nav' => 'train']);
?>
<p class="muted"><?= $isToday ? 'What are you training today?' : 'Logging for <strong>' . e(date('l, j M Y', strtotime($date))) . '</strong>' ?></p>

<?php if (!$trainings): ?>
  <div class="card empty">
    <p>You have no trainings yet.</p>
    <a class="btn primary" href="routine.php">Build your routine</a>
  </div>
<?php endif; ?>

<?php foreach ($trainings as $t): ?>
  <form method="post" class="card pick">
    <?= csrf_field() ?>
    <input type="hidden" name="training_id" value="<?= (int)$t['id'] ?>">
    <input type="hidden" name="date" value="<?= e($date) ?>">
    <div class="grow">
      <div class="title"><?= e($t['name']) ?></div>
      <div class="muted small">
        <?= (int)$t['n'] ?> exercise<?= (int)$t['n'] === 1 ? '' : 's' ?>
        · <?= $t['last_date'] ? 'last ' . date('j M', strtotime($t['last_date'])) : 'never done' ?>
      </div>
    </div>
    <?php if ((int)$t['n'] > 0): ?>
      <button class="btn primary">Start</button>
    <?php else: ?>
      <a class="btn" href="training.php?id=<?= (int)$t['id'] ?>">Add exercises</a>
    <?php endif; ?>
  </form>
<?php endforeach; ?>
<?php page_end();
