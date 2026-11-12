<?php
declare(strict_types=1);

$CFG = require __DIR__ . '/../config.php';
date_default_timezone_set($CFG['timezone']);

if (session_status() !== PHP_SESSION_ACTIVE) {
    ini_set('session.gc_maxlifetime', '5184000');
    session_name('wt_sess');
    session_set_cookie_params(['lifetime' => 5184000, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

/* ---------------------------------------------------------------- DB */

function db(): PDO
{
    global $CFG;
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $opts = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    $dsn = "mysql:host={$CFG['db_host']};port={$CFG['db_port']};charset=utf8mb4";
    try {
        $pdo = new PDO($dsn . ";dbname={$CFG['db_name']}", $CFG['db_user'], $CFG['db_pass'], $opts);
    } catch (PDOException $e) {
        if ((int)$e->getCode() !== 1049) { // 1049 = unknown database
            http_response_code(500);
            exit('<h2>Cannot connect to MySQL</h2><p>Start MySQL (XAMPP) and check config.php.</p><pre>'
                . htmlspecialchars($e->getMessage()) . '</pre>');
        }
        $tmp = new PDO($dsn, $CFG['db_user'], $CFG['db_pass'], $opts);
        $tmp->exec('CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '', $CFG['db_name'])
            . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        $pdo = new PDO($dsn . ";dbname={$CFG['db_name']}", $CFG['db_user'], $CFG['db_pass'], $opts);
    }
    if ($pdo->query("SHOW TABLES LIKE 'log_entries'")->fetchColumn() === false) {
        foreach (explode(';', (string)file_get_contents(__DIR__ . '/../sql/schema.sql')) as $stmt) {
            if (trim(preg_replace('/^\s*--.*$/m', '', $stmt)) !== '') {
                $pdo->exec($stmt);
            }
        }
    }
    return $pdo;
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function all(string $sql, array $params = []): array
{
    return q($sql, $params)->fetchAll();
}

function one(string $sql, array $params = []): ?array
{
    $r = q($sql, $params)->fetch();
    return $r === false ? null : $r;
}

/* ---------------------------------------------------------- helpers */

function e($v): string
{
    return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
}

function redirect(string $url): void
{
    header('Location: ' . $url);
    exit;
}

function num($v): string
{
    if ($v === null || $v === '') {
        return '';
    }
    return rtrim(rtrim(number_format((float)$v, 2, '.', ''), '0'), '.');
}

function dec($v, float $max = 99999): ?float
{
    $v = str_replace(',', '.', trim((string)$v));
    if ($v === '' || !is_numeric($v)) {
        return null;
    }
    return max(0.0, min($max, (float)$v));
}

function valid_date(?string $d): bool
{
    if ($d === null || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) {
        return false;
    }
    $dt = DateTime::createFromFormat('Y-m-d', $d);
    return $dt !== false && $dt->format('Y-m-d') === $d;
}

function flash(string $msg, string $type = 'ok'): void
{
    $_SESSION['flash'] = [$msg, $type];
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}

function csrf_check(): void
{
    $ok = isset($_POST['csrf']) && hash_equals(csrf_token(), (string)$_POST['csrf']);
    if (!$ok) {
        http_response_code(400);
        exit('Session expired. Go back, refresh and try again.');
    }
}

function is_post(): bool
{
    return $_SERVER['REQUEST_METHOD'] === 'POST';
}

/* ------------------------------------------------------------- auth */

function current_user(): ?array
{
    static $u = false;
    if ($u === false) {
        $u = isset($_SESSION['uid'])
            ? one('SELECT id, username, created_at FROM users WHERE id = ?', [$_SESSION['uid']])
            : null;
        if ($u === null) {
            unset($_SESSION['uid']);
        }
    }
    return $u;
}

function require_login(): array
{
    $u = current_user();
    if ($u === null) {
        redirect('auth.php');
    }
    return $u;
}

function login_user(int $id): void
{
    session_regenerate_id(true);
    $_SESSION['uid'] = $id;
}

/* ------------------------------------------------------- domain data */

/** Map of date => [training names] for days with at least one completed set. */
function trained_days(int $uid, string $from, string $to): array
{
    $rows = all(
        'SELECT w.workout_date d, COALESCE(t.name, w.training_name) n
           FROM workouts w LEFT JOIN trainings t ON t.id = w.training_id
          WHERE w.user_id = ? AND w.workout_date BETWEEN ? AND ?
            AND EXISTS (SELECT 1 FROM log_entries l WHERE l.workout_id = w.id AND l.done = 1)
          ORDER BY w.id',
        [$uid, $from, $to]
    );
    $m = [];
    foreach ($rows as $r) {
        $m[$r['d']][] = $r['n'];
    }
    return $m;
}

function own_training(int $uid, int $id): ?array
{
    return one('SELECT * FROM trainings WHERE id = ? AND user_id = ?', [$id, $uid]);
}

function own_exercise(int $uid, int $id): ?array
{
    return one('SELECT * FROM exercises WHERE id = ? AND user_id = ?', [$id, $uid]);
}

function own_workout(int $uid, int $id): ?array
{
    return one(
        'SELECT w.*, COALESCE(t.name, w.training_name) AS tname
           FROM workouts w LEFT JOIN trainings t ON t.id = w.training_id
          WHERE w.id = ? AND w.user_id = ?',
        [$id, $uid]
    );
}

/** Totals of the planned sets for an exercise: [sets, reps] */
function plan_totals(int $exerciseId): array
{
    $r = one('SELECT COUNT(*) s, COALESCE(SUM(target_reps),0) r FROM exercise_sets WHERE exercise_id = ?', [$exerciseId]);
    return [(int)$r['s'], (int)$r['r']];
}

/* ------------------------------------------------------------- view */

function icon(string $n): string
{
    static $p = [
        'home'  => '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
        'play'  => '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z"/>',
        'cal'   => '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
        'list'  => '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
        'plus'  => '<path d="M12 5v14M5 12h14"/>',
        'minus' => '<path d="M5 12h14"/>',
        'check' => '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
        'x'     => '<path d="M6 6l12 12M18 6L6 18"/>',
        'back'  => '<path d="M15 5l-7 7 7 7"/>',
        'next'  => '<path d="M9 5l7 7-7 7"/>',
        'trash' => '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
        'edit'  => '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
        'out'   => '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
        'chart' => '<path d="M4 20V4M4 20h16M8 15l4-5 3 3 5-7"/>',
        'clock' => '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    ];
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        . 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . ($p[$n] ?? '') . '</svg>';
}

/**
 * Options: nav (home|train|calendar|routine), back (url), right (html), shownav (bool)
 */
function page_start(string $title, array $o = []): void
{
    $user = current_user();
    $GLOBALS['__nav'] = $o['nav'] ?? '';
    $GLOBALS['__shownav'] = $o['shownav'] ?? ($user !== null);
    $v = (string)@filemtime(__DIR__ . '/../assets/style.css');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        . '<meta name="theme-color" content="#0f1115">'
        . '<meta name="apple-mobile-web-app-capable" content="yes">'
        . '<meta name="mobile-web-app-capable" content="yes">'
        . '<link rel="manifest" href="manifest.json"><link rel="icon" href="assets/icon.svg">'
        . '<link rel="apple-touch-icon" href="assets/icon.svg">'
        . '<title>' . e($title) . ' · Workout Tracker</title>'
        . '<link rel="stylesheet" href="assets/style.css?v=' . $v . '"></head><body>'
        . '<div class="app"><header class="top">';
    if (!empty($o['back'])) {
        echo '<a class="iconbtn" href="' . e($o['back']) . '" aria-label="Back">' . icon('back') . '</a>';
    }
    echo '<h1>' . e($title) . '</h1><div class="top-right">' . ($o['right'] ?? '') . '</div></header><main>';
    if (!empty($_SESSION['flash'])) {
        [$msg, $type] = $_SESSION['flash'];
        unset($_SESSION['flash']);
        echo '<div class="flash ' . e($type) . '" role="status">' . e($msg) . '</div>';
    }
}

function page_end(): void
{
    echo '</main>';
    if (!empty($GLOBALS['__shownav'])) {
        $a = $GLOBALS['__nav'] ?? '';
        $items = [
            ['home', 'index.php', 'Home', 'home'],
            ['train', 'train.php', 'Train', 'play'],
            ['calendar', 'calendar.php', 'Calendar', 'cal'],
            ['routine', 'routine.php', 'Routine', 'list'],
        ];
        echo '<nav class="tabbar">';
        foreach ($items as [$key, $href, $label, $ic]) {
            echo '<a href="' . $href . '"' . ($a === $key ? ' class="on" aria-current="page"' : '') . '>'
                . icon($ic) . '<span>' . $label . '</span></a>';
        }
        echo '</nav>';
    }
    echo '</div><script src="assets/app.js?v=' . (string)@filemtime(__DIR__ . '/../assets/app.js')
        . '"></script></body></html>';
}

/** Small POST button form with CSRF (used for delete / logout) */
function post_button(string $action, array $fields, string $label, string $class = 'btn', string $confirm = ''): string
{
    $h = '<form method="post" action="' . e($action) . '"' . ($confirm !== '' ? ' data-confirm="' . e($confirm) . '"' : '') . '>'
        . csrf_field();
    foreach ($fields as $k => $v) {
        $h .= '<input type="hidden" name="' . e($k) . '" value="' . e($v) . '">';
    }
    return $h . '<button class="' . e($class) . '">' . $label . '</button></form>';
}
