<?php
require __DIR__ . '/inc/lib.php';
$user = require_login();
$uid = (int)$user['id'];

if (is_post()) {
    csrf_check();
    $name = trim((string)($_POST['name'] ?? ''));
    if ($name === '' || mb_strlen($name) > 60) {
        flash('Enter a training name (max 60 characters).', 'err');
    } else {
        $next = (int)q('SELECT COALESCE(MAX(sort_order),0)+1 FROM trainings WHERE user_id = ?', [$uid])->fetchColumn();
        q('INSERT INTO trainings (user_id, name, sort_order) VALUES (?,?,?)', [$uid, $name, $next]);
        flash("Added $name. Now add exercises to it.");
        redirect('training.php?id=' . db()->lastInsertId());
    }
    redirect('routine.php');
}

$trainings = all(
    'SELECT t.*, (SELECT COUNT(*) FROM exercises e WHERE e.training_id = t.id) AS n
       FROM trainings t WHERE t.user_id = ? ORDER BY t.sort_order, t.id', [$uid]
);

page_start('My Routine', ['nav' => 'routine']);
?>
<p class="muted">Your trainings (like Push, Pull, Legs). Open one to add its exercises.</p>

<?php if (!$trainings): ?>
  <div class="card empty"><p>No trainings yet. Add your first one below.</p></div>
<?php endif; ?>
<div class="list">
<?php foreach ($trainings as $t): ?>
  <a class="item" href="training.php?id=<?= (int)$t['id'] ?>">
    <div class="grow">
      <div class="title"><?= e($t['name']) ?></div>
      <div class="muted small"><?= (int)$t['n'] ?> exercise<?= (int)$t['n'] === 1 ? '' : 's' ?></div>
    </div>
    <?= icon('next') ?>
  </a>
<?php endforeach; ?>
</div>

<form method="post" class="card stack">
  <?= csrf_field() ?>
  <label>Add training
    <input name="name" placeholder="e.g. Push, Pull, Legs, Cardio" maxlength="60" required>
  </label>
  <button class="btn primary block"><?= icon('plus') ?> Add training</button>
</form>
<?php page_end();
