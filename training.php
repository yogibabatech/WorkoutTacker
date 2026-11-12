<?php
require __DIR__ . '/inc/lib.php';
$user = require_login();
$uid = (int)$user['id'];

$t = own_training($uid, (int)($_GET['id'] ?? $_POST['id'] ?? 0));
if (!$t) {
    redirect('routine.php');
}
$tid = (int)$t['id'];

if (is_post()) {
    csrf_check();
    $act = $_POST['action'] ?? '';
    if ($act === 'rename') {
        $name = trim((string)($_POST['name'] ?? ''));
        if ($name === '' || mb_strlen($name) > 60) {
            flash('Enter a valid name.', 'err');
        } else {
            q('UPDATE trainings SET name = ? WHERE id = ?', [$name, $tid]);
            flash('Renamed.');
        }
    } elseif ($act === 'delete') {
        q('DELETE FROM trainings WHERE id = ?', [$tid]);
        flash('Training deleted. Your past logs are kept in the calendar.');
        redirect('routine.php');
    }
    redirect('training.php?id=' . $tid);
}

$exs = all('SELECT * FROM exercises WHERE training_id = ? ORDER BY sort_order, id', [$tid]);

page_start($t['name'], ['nav' => 'routine', 'back' => 'routine.php']);
?>
<h3 class="section">Exercises</h3>
<?php if (!$exs): ?>
  <div class="card empty"><p>No exercises yet. Add the first one.</p></div>
<?php endif; ?>
<div class="list">
<?php foreach ($exs as $x): ?>
  <a class="item" href="exercise.php?id=<?= (int)$x['id'] ?>">
    <div class="grow">
      <div class="title"><?= e($x['name']) ?></div>
      <div class="muted small">
        <?php if ($x['type'] === 'sets'):
            [$ns, $nr] = plan_totals((int)$x['id']); ?>
          <?= $ns ?> sets · <?= $nr ?> reps<?= $x['target_weight'] !== null ? ' · ' . num($x['target_weight']) . ' kg' : '' ?><?= $x['est_duration_min'] ? ' · ~' . (int)$x['est_duration_min'] . ' min' : '' ?>
        <?php else: ?>
          Duration · target <?= (int)$x['target_duration_min'] ?> min
        <?php endif; ?>
      </div>
    </div>
    <?= icon('edit') ?>
  </a>
<?php endforeach; ?>
</div>
<a class="btn primary block" href="exercise.php?training_id=<?= $tid ?>"><?= icon('plus') ?> Add exercise</a>

<h3 class="section">Training settings</h3>
<form method="post" class="card stack">
  <?= csrf_field() ?>
  <input type="hidden" name="action" value="rename">
  <input type="hidden" name="id" value="<?= $tid ?>">
  <label>Name <input name="name" value="<?= e($t['name']) ?>" maxlength="60" required></label>
  <button class="btn block">Save name</button>
</form>
<?= post_button('training.php', ['action' => 'delete', 'id' => $tid], icon('trash') . ' Delete training', 'btn danger block', 'Delete this training and all its exercises?') ?>
<?php page_end();
