<?php
require __DIR__ . '/inc/lib.php';
if (is_post()) {
    csrf_check();
    $_SESSION = [];
    session_destroy();
}
redirect('auth.php');
