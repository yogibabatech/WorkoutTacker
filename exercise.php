<?php
require __DIR__ . '/inc/lib.php';
$user = require_login();
$uid = (int)$user['id'];

$ex = null;
if (isset($_GET['id']) || isset($_POST['id'])) {
    $ex = own_exercise($uid, (int)($_GET['id'] ?? $_POST['id']));
    if (!$ex) {
        redirect('routine.php');
    }
    $tid = (int)$ex['training_id'];
} else {
    $tid = (int)($_GET['training_id'] ?? $_POST['training_id'] ?? 0);
}
$training = own_training($uid, $tid);
if (!$training) {
    redirect('routine.php');
}

// Form state (defaults / loaded / re-shown on error)
$f = [
    'name' => $ex['name'] ?? '',
    'description' => $ex['description'] ?? '',
    'type' => $ex['type'] ?? 'sets',
    'target_weight' => $ex ? num($ex['target_weight']) : '',
    'est_duration_min' => $ex['est_duration_min'] ?? '',
    'target_duration_min' => $ex['target_duration_min'] ?? '',
];
$sets = $ex ? all('SELECT target_reps, target_weight FROM exercise_sets WHERE exercise_id = ? ORDER BY set_no', [$ex['id']]) : [];
if (!$sets) {
    $sets = array_fill(0, 3, ['target_reps' => 10, 'target_weight' => null]);
}

if (is_post()) {
    csrf_check();
    if (($_POST['action'] ?? '') === 'delete' && $ex) {
        q('DELETE FROM exercises WHERE id = ?', [$ex['id']]);
        flash('Exercise deleted.');
        redirect('training.php?id=' . $tid);
    }

    $f['name'] = trim((string)($_POST['name'] ?? ''));
    $f['description'] = trim((string)($_POST['description'] ?? ''));
    $f['type'] = ($_POST['type'] ?? '') === 'duration' ? 'duration' : 'sets';
    $f['target_weight'] = (string)($_POST['target_weight'] ?? '');
    $f['est_duration_min'] = (string)($_POST['est_duration_min'] ?? '');
    $f['target_duration_min'] = (string)($_POST['target_duration_min'] ?? '');

    $newSets = [];
    foreach ((array)($_POST['sets'] ?? []) as $s) {
        $r = dec($s['reps'] ?? '', 9999);
        if ($r !== null && $r > 0) {
            $newSets[] = ['target_reps' => (int)$r, 'target_weight' => dec($s['weight'] ?? '', 9999)];
        }
    }

    $err = '';
    if ($f['name'] === '' || mb_strlen($f['name']) > 80) {
        $err = 'Enter an exercise name (max 80 characters).';
    } elseif ($f['type'] === 'sets' && !$newSets) {
        $err = 'Add at least one set with reps.';
    } elseif ($f['type'] === 'duration' && !(dec($f['target_duration_min']) > 0)) {
        $err = 'Enter a target duration in minutes.';
    }

    if ($err === '') {
        $tw = $f['type'] === 'sets' ? dec($f['target_weight'], 9999) : null;
        $est = $f['type'] === 'sets' ? dec($f['est_duration_min'], 9999) : null;
        $td = $f['type'] === 'duration' ? dec($f['target_duration_min'], 9999) : null;
        $est = $est !== null ? (int)round($est) : null;
        $td = $td !== null ? (int)round($td) : null;
        $desc = $f['description'] === '' ? null : $f['description'];

        $pdo = db();
        $pdo->beginTransaction();
        if ($ex) {
            $id = (int)$ex['id'];
            q('UPDATE exercises SET name=?, description=?, type=?, target_weight=?, est_duration_min=?, target_duration_min=? WHERE id=?',
                [$f['name'], $desc, $f['type'], $tw, $est, $td, $id]);
            q('DELETE FROM exercise_sets WHERE exercise_id = ?', [$id]);
        } else {
            $next = (int)q('SELECT COALESCE(MAX(sort_order),0)+1 FROM exercises WHERE training_id = ?', [$tid])->fetchColumn();
            q('INSERT INTO exercises (user_id, training_id, name, description, type, target_weight, est_duration_min, target_duration_min, sort_order)
               VALUES (?,?,?,?,?,?,?,?,?)', [$uid, $tid, $f['name'], $desc, $f['type'], $tw, $est, $td, $next]);
            $id = (int)$pdo->lastInsertId();
        }
        if ($f['type'] === 'sets') {
            foreach ($newSets as $i => $s) {
                q('INSERT INTO exercise_sets (exercise_id, set_no, target_reps, target_weight) VALUES (?,?,?,?)',
                    [$id, $i + 1, $s['target_reps'], $s['target_weight']]);
            }
        }
        $pdo->commit();
        flash($ex ? 'Exercise saved.' : 'Exercise added.');
        redirect('training.php?id=' . $tid);
    }
    flash($err, 'err');
    $sets = $newSets ?: $sets;
}

page_start($ex ? 'Edit exercise' : 'New exercise', ['nav' => 'routine', 'back' => 'training.php?id=' . $tid]);
?>
<p class="muted">In <strong><?= e($training['name']) ?></strong></p>
<form method="post" class="stack" id="exform">
  <?= csrf_field() ?>
  <input type="hidden" name="training_id" value="<?= $tid ?>">
  <?php if ($ex): ?><input type="hidden" name="id" value="<?= (int)$ex['id'] ?>"><?php endif; ?>

  <div class="card stack">
    <label>Name
      <input name="name" value="<?= e($f['name']) ?>" placeholder="e.g. Bench Press" maxlength="80" required>
    </label>
    <label>Description <span class="muted small">(optional)</span>
      <textarea name="description" rows="3" placeholder="How to do it, form cues, machine settings…"><?= e($f['description']) ?></textarea>
    </label>
    <div>
      <div class="lbl">Type</div>
      <div class="seg" data-seg>
        <label><input type="radio" name="type" value="sets" <?= $f['type'] === 'sets' ? 'checked' : '' ?>><span>Sets × reps</span></label>
        <label><input type="radio" name="type" value="duration" <?= $f['type'] === 'duration' ? 'checked' : '' ?>><span>Duration</span></label>
      </div>
    </div>
  </div>

  <div class="card stack" data-show="sets">
    <div class="two">
      <label>Target weight (kg)
        <input name="target_weight" inputmode="decimal" value="<?= e($f['target_weight']) ?>" placeholder="80">
      </label>
      <label>Est. time to hit it (min)
        <input name="est_duration_min" inputmode="numeric" value="<?= e($f['est_duration_min']) ?>" placeholder="45">
      </label>
    </div>
    <div class="lbl">Sets <span class="muted small">weight blank = target weight</span></div>
    <div id="setlist" class="stack tight">
      <?php foreach ($sets as $i => $s): ?>
        <div class="setdef">
          <span class="setno"><?= $i + 1 ?></span>
          <input name="sets[<?= $i ?>][reps]" inputmode="numeric" placeholder="reps" value="<?= e($s['target_reps']) ?>" aria-label="Reps">
          <input name="sets[<?= $i ?>][weight]" inputmode="decimal" placeholder="kg" value="<?= e(num($s['target_weight'])) ?>" aria-label="Weight">
        </div>
      <?php endforeach; ?>
    </div>
    <div class="row gap">
      <button type="button" class="btn grow" data-add-def><?= icon('plus') ?> Add set</button>
      <button type="button" class="btn grow" data-del-def><?= icon('minus') ?> Remove set</button>
    </div>
    <div class="totals muted" id="totals"></div>
  </div>

  <div class="card stack" data-show="duration">
    <label>Target duration (min)
      <input name="target_duration_min" inputmode="numeric" value="<?= e($f['target_duration_min']) ?>" placeholder="30">
    </label>
  </div>

  <button class="btn primary block">Save exercise</button>
</form>

<?php if ($ex): ?>
  <?= post_button('exercise.php', ['action' => 'delete', 'id' => $ex['id']], icon('trash') . ' Delete exercise', 'btn danger block', 'Delete this exercise? Logged history for it stays in the calendar.') ?>
  <a class="btn block" href="timeline.php?id=<?= (int)$ex['id'] ?>"><?= icon('chart') ?> View timeline</a>
<?php endif; ?>
<?php page_end();
