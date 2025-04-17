import { $ } from 'bun';

$.cwd(__dirname);

const argsScriptIndex =
  Bun.argv.findIndex((arg) => arg.endsWith('bun-script.ts')) + 1;

const scriptName = Bun.argv[argsScriptIndex];

const forwardArgsIndex = argsScriptIndex + 1;
const forwardArgs = Bun.argv.slice(forwardArgsIndex);
const forwardArgsString = forwardArgs.length ? ` ${forwardArgs.join(' ')}` : '';

try {
  await $`bun run --tsconfig-override ../tsconfig.bun.json ./bun-scripts/${scriptName}.ts${forwardArgsString}`.catch(
    (err) => {
      if (err.exitCode === 9) {
        process.exit(0);
      }

      console.error(`\nFailed with code ${err.exitCode}`);
      console.error(err.stdout?.toString());
      console.error(err.stderr?.toString());
      process.exit(1);
    },
  );
} catch (err) {
  console.log(`\nFailed with code ${err.exitCode}`);
  console.log(err.stdout?.toString());
  console.log(err.stderr?.toString());
}
