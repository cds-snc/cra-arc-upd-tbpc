import { $ } from 'bun';

if (Bun.argv.length < 3) {
  console.log('Usage: buns new <filename>');
  process.exit(0);
}

$.cwd(__dirname);

const args = Bun.argv.slice(2);

const template =
  Bun.argv.find((arg) => arg.startsWith('--template='))?.split('=')[1] ||
  'default';

const filename = `${args[0]}.ts`;

await $`cp ./templates/${template}.ts ./${filename}`;

console.log(`Created new file: ${filename}`);
