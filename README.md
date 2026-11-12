# Workout Tracker (PHP + MySQL, mobile-first)

## Run
1. Start **MySQL** in XAMPP (defaults: user `root`, empty password; edit `config.php` if yours differ).
2. From this folder:
   `C:\xampp\php\php.exe -S 0.0.0.0:8080`
   then open http://localhost:8080 (on your phone: http://<PC-IP>:8080 on the same Wi-Fi).
   Or copy the folder into `C:\xampp\htdocs\` and use Apache.
3. The database `workout_tracker` and its tables are created automatically on first load (`sql/schema.sql`).

Timezone is set in `config.php` (`Asia/Kolkata`).
