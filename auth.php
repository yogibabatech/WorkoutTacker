<?php
require __DIR__ . '/inc/lib.php';

if (current_user() !== null) {
    redirect('index.php');
}

$mode = ($_GET['mode'] ?? 'login') === 'signup' ? 'signup' : 'login';
$err = '';
$username = '';

if (is_post()) {
    csrf_check();
    $mode = ($_POST['mode'] ?? '') === 'signup' ? 'signup' : 'login';
    $username = trim((string)($_POST['username'] ?? ''));
    $password = (string)($_POST['password'] ?? '');

    if ($mode === 'signup') {
        if (!preg_match('/^[A-Za-z0-9_.-]{3,30}$/', $username)) {
            $err = 'Username must be 3-30 characters: letters, numbers, . _ -';
        } elseif (strlen($password) < 4) {
            $err = 'Password must be at least 4 characters.';
        } elseif (one('SELECT id FROM users WHERE username = ?', [$username])) {
            $err = 'That username is taken. Try another.';
        } else {
            q('INSERT INTO users (username, password_hash, created_at) VALUES (?,?,?)',
                [$username, password_hash($password, PASSWORD_DEFAULT), date('Y-m-d H:i:s')]);
            login_user((int)db()->lastInsertId());
            flash('Welcome! Start by building your routine.');
            redirect('routine.php');
        }
    } else {
        $u = one('SELECT id, password_hash FROM users WHERE username = ?', [$username]);
        if ($u && password_verify($password, $u['password_hash'])) {
            login_user((int)$u['id']);
            redirect('index.php');
        }
        $err = 'Wrong username or password.';
    }
}

page_start($mode === 'signup' ? 'Sign up' : 'Log in', ['shownav' => false]);
?>
<div class="auth">
  <div class="logo"><img src="assets/icon.svg" alt="" width="72" height="72"></div>
  <h2><?= $mode === 'signup' ? 'Create your account' : 'Welcome back' ?></h2>
  <p class="muted center"><?= $mode === 'signup' ? 'Pick a username and password. No email or OTP needed.' : 'Log in to continue your training.' ?></p>

  <?php if ($err): ?><div class="flash err"><?= e($err) ?></div><?php endif; ?>

  <form method="post" class="card stack" autocomplete="on">
    <?= csrf_field() ?>
    <input type="hidden" name="mode" value="<?= $mode ?>">
    <label>Username
      <input name="username" value="<?= e($username) ?>" autocomplete="username" autocapitalize="none" required autofocus maxlength="30">
    </label>
    <label>Password
      <span class="pw">
        <input type="password" name="password" autocomplete="<?= $mode === 'signup' ? 'new-password' : 'current-password' ?>" required>
        <button type="button" class="link" data-toggle-pw>Show</button>
      </span>
    </label>
    <button class="btn primary block"><?= $mode === 'signup' ? 'Sign up' : 'Log in' ?></button>
  </form>

  <p class="center">
    <?php if ($mode === 'signup'): ?>
      Already have an account? <a href="auth.php">Log in</a>
    <?php else: ?>
      New here? <a href="auth.php?mode=signup">Create an account</a>
    <?php endif; ?>
  </p>
</div>
<?php page_end();
