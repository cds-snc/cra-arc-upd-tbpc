import { ModuleRef } from '@nestjs/core';
import type { Type } from '@nestjs/common';
import { RunScriptCommand } from '../../run-script.command';
import { DbService } from '@dua-upd/db';
import { logJson, round } from '@dua-upd/utils-common';

export const startTimer = (label1: string) => {
  const start = Date.now();

  return (label2?: string) => {
    const end = Date.now();
    console.log(
      `${label1} ${label2 || ''}: ${((end - start) / 1000).toFixed(2)}s`,
    );
  };
};

function getModuleRef<T extends { moduleRef: ModuleRef }>(_this: T): ModuleRef {
  if (!_this) {
    throw new Error('Must be called with `this` bound to a context');
  }

  if (!_this.moduleRef) {
    throw new Error('`this` must have a `moduleRef` property');
  }

  return (<T>_this).moduleRef;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export type TypeOrToken = string | symbol | Function | Type;

export function inject<T extends TypeOrToken, U = T extends string ? never : T>(
  this: ThisType<typeof RunScriptCommand> & { moduleRef: ModuleRef },
  typeOrToken: T,
): U {
  return getModuleRef(this).get(typeOrToken, { strict: false });
}

export async function benchFunction(
  db: DbService,
  func: (db: DbService) => Promise<any>,
  numIterations = 50,
) {
  const results = [];

  let returnVal;

  for (let i = 0; i < numIterations; i++) {
    const start = performance.now();

    const val = await func(db);

    const timeSpent = round(performance.now() - start, 4);

    if (!returnVal) {
      returnVal = val;
    }

    results.push(timeSpent);
  }

  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  const min = Math.min(...results);
  const max = Math.max(...results);
  const std = Math.sqrt(
    results.reduce((a, b) => a + (b - avg) ** 2, 0) / results.length,
  );

  console.log(`Benching ${func.name}`);
  console.log(`average: ${avg}`);
  console.log(`min: ${min}`);
  console.log(`max: ${max}`);
  console.log(`std: ${std}`);

  return returnVal;
}
