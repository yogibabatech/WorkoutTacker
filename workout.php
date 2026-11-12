<?php
require __DIR__ . '/inc/lib.php';
$user = require_login();
$uid = (int)$user['id'];

$w = own_workout($uid, (int)($_GET['id'] ?? $_POST['id'] ?? 0));
if (!$w) {
    redirect('index.php');
}
$wid = (int)$w['id'];

$exs = $w['training_id']
    ? all('SELECT * FROM exercises WHERE training_id = ? AND user_id = ? ORDER BY sort_order, id', [$w['training_id'], $uid])
    : [];
$exById = [];
foreach ($exs as $x) {
    $exById[(int)$x['id']] = $x;
}

if (is_post()) {
    csrf_check();
    $act = $_POST['action'] ?? 'save';

    if ($act === 'discard') {
        q('DELETE FROM workouts WHERE id = ?', [$wid]);
        flash('Workout discarded.');
        redirect('index.php');
    }

    $pdo = db();
    $pdo->beginTransaction();
    if ($exById) {
        $in = implode(',', array_keys($exById));
        $pdo->exec("DELETE FROM log_entries WHERE workout_id = $wid AND exercise_id IN ($in)");
    }
    $ins = $pdo->prepare('INSERT INTO log_entries (workout_id, exercise_id, exercise_name, set_no, weight, reps, duration_min, done)
                          VALUES (?,?,?,?,?,?,?,?)');
    foreach ((array)($_POST['e'] ?? []) as $exId => $rows) {
        $x = $exById[(int)$exId] ?? null;
        if (!$x || !is_array($rows)) {
            continue;
        }
        $n = 0;
        foreach ($rows as $r) {
            $ok = !empty($r['ok']) ? 1 : 0;
            $wt = dec($r['w'] ?? '', 9999);
            $reps = dec($r['r'] ?? '', 9999);
            $dur = dec($r['d'] ?? '', 9999);
            if ($x['type'] === 'duration') {
                $wt = $reps = null;
                if ($dur === null && !$ok) {
                    continue;
                }
                if ($ok && $dur === null) {
                    $dur = (float)$x['target_duration_min'];
                }
            } else {
                $dur = null;
                if ($wt === null && $reps === null && !$ok) {
                    continue;
                }
            }
            $ins->execute([$wid, $x['id'], $x['name'], ++$n, $wt, $reps !== null ? (int)$reps : null, $dur, $ok]);
        }
    }
    $pdo->commit();

    if ($act === 'finish') {
        q('UPDATE workouts SET finished_at = ? WHERE id = ?', [date('Y-m-d H:i:s'), $wid]);
        $done = (int)q('SELECT COUNT(*) FROM log_entries WHERE workout_id = ? AND done = 1', [$wid])->fetchColumn();
        flash($done > 0 ? 'Workout logged. Nice work! 💪' : 'Finished, but no sets were ticked, so this day still counts as no training.', $done > 0 ? 'ok' : 'err');
        redirect('index.php');
    }
    flash('Saved.');
    redirect('workout.php?id=' . $wid);
}

// Existing log rows of this workout
$logged = [];
foreach (all('SELECT * FROM log_entries WHERE workout_id = ? ORDER BY exercise_id, set_no', [$wid]) as $l) {
    $logged[(int)$l['exercise_id']][] = $l;
}
// Plans
$plans = [];
if ($exById) {
    $in = implode(',', array_keys($exById));
    foreach (all("SELECT * FROM exercise_sets WHERE exercise_id IN ($in) ORDER BY exercise_id, set_no") as $p) {
        $plans[(int)$p['exercise_id']][] = $p;
    }
}
// "Last time" for each exercise (most recent earlier workout with done sets)
$last = [];
if ($exById) {
    $in = implode(',', array_keys($exById));
    $rows = all(
        "SELECT l.exercise_id, l.workout_id, l.weight, l.reps, l.duration_min
           FROM log_entries l JOIN workouts wk ON wk.id = l.workout_id
          WHERE wk.user_id = ? AND wk.id <> ? AND wk.workout_date <= ? AND l.done = 1 AND l.exercise_id IN ($in)
          ORDER BY wk.workout_date DESC, wk.id DESC, l.set_no",
        [$uid, $wid, $w['workout_date']]
    );
    $firstWo = [];
    foreach ($rows as $r) {
        $eid = (int)$r['exercise_id'];
        $firstWo[$eid] = $firstWo[$eid] ?? $r['workout_id'];
        if ($firstWo[$eid] === $r['workout_id']) {
            $last[$eid][] = $r;
        }
    }
}

function set_row(int $exId, int $i, array $r, string $type): string
{
    $h = '<div class="setrow" data-row><span class="setno">' . ($i + 1) . '</span>';
    if ($type === 'sets') {
        $h .= '<input name="e[' . $exId . '][' . $i . '][w]" inputmode="decimal" placeholder="kg" value="' . e($r['w']) . '" aria-label="Weight in kg">'
            . '<span class="x">×</span>'
            . '<input name="e[' . $exId . '][' . $i . '][r]" inputmode="numeric" placeholder="reps" value="' . e($r['r']) . '" aria-label="Reps">';
    } else {
        $h .= '<input class="wide" name="e[' . $exId . '][' . $i . '][d]" inputmode="decimal" placeholder="' . e($r['ph']) . '" value="' . e($r['d']) . '" aria-label="Duration in minutes"><span class="unit">min</span>';
    }
    return $h . '<label class="chk"><input type="checkbox" name="e[' . $exId . '][' . $i . '][ok]" value="1"' . ($r['ok'] ? ' checked' : '') . ' aria-label="Done">'
        . '<span>' . icon('check') . '</span></label></div>';
}

page_start($w['tname'], [
    'back' => 'index.php',
    'shownav' => false,
    'right' => '<span class="pill">' . e(date('D, j M', strtotime($w['workout_date']))) . '</span>',
]);
?>
<?php if (!$exs): ?>
  <div class="card empty">
    <p>This training has no exercises<?= $w['training_id'] ? '' : ' (it was deleted)' ?>.</p>
    <?php if ($w['training_id']): ?><a class="btn primary" href="training.php?id=<?= (int)$w['training_id'] ?>">Add exercises</a><?php endif; ?>
  </div>
<?php endif; ?>

<form method="post" id="wform" class="stack">
  <?= csrf_field() ?>
  <input type="hidden" name="id" value="<?= $wid ?>">

  <div class="progress" aria-hidden="true"><i id="pbar"></i></div>
  <div class="muted small" id="ptext"></div>

<?php foreach ($exs as $x):
    $xid = (int)$x['id'];
    $rows = [];
    if (!empty($logged[$xid])) {
        foreach ($logged[$xid] as $l) {
            $rows[] = ['w' => num($l['weight']), 'r' => $l['reps'] ?? '', 'd' => num($l['duration_min']), 'ok' => (int)$l['done'], 'ph' => ''];
        }
    } elseif ($x['type'] === 'sets') {
        foreach ($plans[$xid] ?? [] as $p) {
            $rows[] = ['w' => num($p['target_weight'] ?? $x['target_weight']), 'r' => $p['target_reps'], 'd' => '', 'ok' => 0, 'ph' => ''];
        }
        if (!$rows) {
            $rows[] = ['w' => num($x['target_weight']), 'r' => '', 'd' => '', 'ok' => 0, 'ph' => ''];
        }
    } else {
        $rows[] = ['w' => '', 'r' => '', 'd' => '', 'ok' => 0, 'ph' => (string)(int)$x['target_duration_min']];
    }
    [$ps, $pr] = $x['type'] === 'sets' ? plan_totals($xid) : [0, 0];
?>
  <section class="card ex" data-ex="<?= $xid ?>" data-type="<?= e($x['type']) ?>">
    <div class="exhead">
      <div class="grow">
        <h3><?= e($x['name']) ?></h3>
        <div class="chips">
          <?php if ($x['type'] === 'sets'): ?>
            <?php if ($x['target_weight'] !== null): ?><span class="chip">🎯 <?= num($x['target_weight']) ?> kg</span><?php endif; ?>
            <?php if ($x['est_duration_min']): ?><span class="chip"><?= icon('clock') ?> ~<?= (int)$x['est_duration_min'] ?> min</span><?php endif; ?>
            <span class="chip"><?= $ps ?> sets</span><span class="chip"><?= $pr ?> reps</span>
          <?php else: ?>
            <span class="chip"><?= icon('clock') ?> target <?= (int)$x['target_duration_min'] ?> min</span>
          <?php endif; ?>
        </div>
      </div>
      <a class="iconbtn" href="timeline.php?id=<?= $xid ?>" aria-label="Timeline"><?= icon('chart') ?></a>
    </div>
    <?php if ($x['description']): ?>
      <details class="desc"><summary>How to</summary><p><?= nl2br(e($x['description'])) ?></p></details>
    <?php endif; ?>
    <?php if (!empty($last[$xid])): ?>
      <div class="lasttime muted small">Last time:
        <?php if ($x['type'] === 'sets'):
            echo e(implode(', ', array_map(fn($l) => num($l['weight']) . '×' . $l['reps'], $last[$xid])));
        else:
            echo e(num($last[$xid][0]['duration_min'])) . ' min';
        endif; ?>
      </div>
    <?php endif; ?>

    <div class="sets" data-sets>
      <?php foreach ($rows as $i => $r) { echo set_row($xid, $i, $r, $x['type']); } ?>
    </div>
    <?php if ($x['type'] === 'sets'): ?>
      <div class="row gap">
        <button type="button" class="btn small grow" data-add-set><?= icon('plus') ?> Set</button>
        <button type="button" class="btn small grow" data-rm-set><?= icon('minus') ?> Set</button>
      </div>
    <?php endif; ?>
  </section>
<?php endforeach; ?>

<?php if ($exs): ?>
  <div class="savebar">
    <button class="btn" name="action" value="save">Save</button>
    <button class="btn primary" name="action" value="finish">Finish workout</button>
  </div>
<?php endif; ?>
</form>

<?= post_button('workout.php', ['action' => 'discard', 'id' => $wid], icon('trash') . ' Discard this workout', 'btn danger block', 'Discard this workout and everything logged in it?') ?>
<div class="spacer"></div>
<?php page_end();
