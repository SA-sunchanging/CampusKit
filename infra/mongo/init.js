// Runs once, when the mongo volume is first created.
// One database and one user per service (database per service). Demo credentials only.
const databases = [
  ['review_db', 'review_user', 'review_pass'],
  ['notification_db', 'notification_user', 'notification_pass'],
];
for (const [name, user, pwd] of databases) {
  db.getSiblingDB(name).createUser({ user, pwd, roles: [{ role: 'readWrite', db: name }] });
}
