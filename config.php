<?php
// Database settings. Defaults match a stock XAMPP install (root, no password).
// Override with environment variables WT_DB_HOST / WT_DB_NAME / WT_DB_USER / WT_DB_PASS if needed.
return [
    'db_host'  => getenv('WT_DB_HOST') ?: '127.0.0.1',
    'db_port'  => (int)(getenv('WT_DB_PORT') ?: 3306),
    'db_name'  => getenv('WT_DB_NAME') ?: 'workout_tracker',
    'db_user'  => getenv('WT_DB_USER') ?: 'root',
    'db_pass'  => getenv('WT_DB_PASS') !== false ? getenv('WT_DB_PASS') : '',
    'timezone' => getenv('WT_TZ') ?: 'Asia/Kolkata',
];
