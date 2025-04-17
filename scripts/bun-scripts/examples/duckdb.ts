import { Database } from 'duckdb-async';

const db = await Database.create(':memory:');

await db.exec('CREATE TABLE test (id INTEGER, name VARCHAR)');

await db.exec("INSERT INTO test VALUES (1, 'Alice'), (2, 'Bob')");

try {
  const result = await db.all('SELECT * FROM test');

  console.log(result);

  await db.exec('DROP TABLE test');

  await db.close();

  process.exit(0);
} catch (err) {
  console.error(`Error: ${err.message}`);
  console.error(`Stack: ${err.stack}`);

  await db.close();
  
  process.exit(1);
}