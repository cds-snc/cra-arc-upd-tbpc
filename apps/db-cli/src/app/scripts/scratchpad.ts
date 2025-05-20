import { DbService } from '@dua-upd/db';
import { dayjs, logJson, prettyJson, TimingUtility } from '@dua-upd/utils-common';
import { readFile, writeFile } from 'fs/promises';
import { difference } from 'rambdax';
import { LoggerService } from '@dua-upd/logger';
import { BlobStorageService } from '@dua-upd/blob-storage';
import { PipelineStage } from 'mongoose';

/*
 *  Export any function and it'll show up with the "run-script" command.
 *
 *  Every function is run with dependencies defined in run-script.command.ts
 *  Which, as of writing this comment, is the following:
 *
 *  const scriptDependencies: Parameters<DbScript> = [this.db, this.dbUpdateService]; (DbService and DbUpdateService)
 */

export const reformatI18n = async (db: DbService) => {
  const en = JSON.parse(
    await readFile(
      'libs/upd/i18n/src/lib/translations/calldrivers_en-CA.json',
      'utf-8'
    )
  );

  const fr = JSON.parse(
    await readFile(
      'libs/upd/i18n/src/lib/translations/calldrivers_fr-CA.json',
      'utf-8'
    )
  );

  const enKeys = Object.keys(en);
  const frKeys = Object.keys(fr);

  const inEnNotFr = difference(enKeys, frKeys);
  const inFrNotEn = difference(frKeys, enKeys);

  if (inEnNotFr.length || inFrNotEn.length) {
    throw Error(
      `en/fr files have mismatched keys:
      in en, not fr: ${prettyJson(inEnNotFr)}
      in fr, not en: ${prettyJson(inFrNotEn)}`
    );
  }

  const translationMap = {
    enquiry_line: new Map<string, string>(),
    topic: new Map<string, string>(),
    subtopic: new Map<string, string>(),
    sub_subtopic: new Map<string, string>(),
  };

  for (const key of enKeys) {
    const enTranslations = en[key];
    const frTranslations = fr[key];

    translationMap.enquiry_line.set(
      enTranslations['inquiry line'],
      frTranslations['inquiry line']
    );

    translationMap.topic.set(enTranslations['topic'], frTranslations['topic']);

    translationMap.subtopic.set(
      enTranslations['sub-topic'],
      frTranslations['sub-topic']
    );

    translationMap.sub_subtopic.set(
      enTranslations['sub-subtopic'],
      frTranslations['sub-subtopic']
    );
  }

  const enOut = Object.fromEntries(
    Object.values(translationMap)
      .map((v) => [...v.entries()].map(([k]) => [k, k]))
      .flat()
  );
  const frOut = Object.fromEntries(
    Object.values(translationMap)
      .map((translation) => [...translation])
      .flat()
  );

  await writeFile(
    'libs/upd/i18n/src/lib/translations/calldrivers_en-CA2.json',
    prettyJson(enOut)
  );
  await writeFile(
    'libs/upd/i18n/src/lib/translations/calldrivers_fr-CA2.json',
    prettyJson(frOut)
  );
};

export const testLogging = async (db: DbService, _, logger: LoggerService) => {
  const errorTarget = `db-update_test_${new Date().toISOString().slice(0, 10)}`;
  const logTarget = `db-update_test_full-log_${new Date().toISOString().slice(0, 10)}`;

  const blobLog = logger.createBlobLogger({
    blobModel: 'db_updates',
    logLevelTargets: { error: errorTarget, warn: errorTarget, log: logTarget },
    context: 'testLogging',
  });

  const msg = 'logging blobLog logger to log blob if error';

  blobLog.accent('logging normal logs for forestry and ' + msg);
  blobLog.info('logging normal logs for forestry and ' + msg);
  const error = Error('uh oh! ' + msg);
  blobLog.error(error.stack);
  blobLog.error(msg + '2');
  blobLog.warn('WARNING: ' + msg);
};

export const testBlobb = async (
  db: DbService,
  _,
  __,
  blob: BlobStorageService
) => {
  // await blob.blobModels.db_updates.getContainer().listBlobs('db_updates');
  await blob.blobModels.db_updates.getContainer().mapBlobs((item) => {
    logJson(item);
  }, 'db_updates');
};


// export const exportTempTimeSeries = async (db: DbService) => {
//   const uniqueDates = (await db.collections.pageMetrics.distinct<Date>('date'))
//     .sort((a, b) => a.getTime() - b.getTime())
//     .filter((date) => dayjs(date).isAfter('2019-12-31'));

//   const totalDates = uniqueDates.length;

//   console.log(`Exporting data for ${totalDates} dates`);

//   const timer = new TimingUtility(totalDates);

//   for (const date of uniqueDates) {

//     const pipeline = db.collections.pageMetrics
//       .aggregate()
//       .match({ date })
//       .addFields({
//         meta: {
//           url: '$url',
//           page: '$page',
//           projects: {
//             $cond: {
//               if: {
//                 $eq: [{ $size: { $ifNull: ['$projects', []] } }, 0],
//               },
//               then: '$$REMOVE',
//               else: '$projects',
//             },
//           },
//           tasks: {
//             $cond: {
//               if: {
//                 $eq: [{ $size: { $ifNull: ['$tasks', []] } }, 0],
//               },
//               then: '$$REMOVE',
//               else: '$tasks',
//             },
//           },
//           ux_tests: {
//             $cond: {
//               if: {
//                 $eq: [{ $size: { $ifNull: ['$ux_tests', []] } }, 0],
//               },
//               then: '$$REMOVE',
//               else: '$ux_tests',
//             },
//           },
//         },
//       })
//       .project({
//         date: 1,
//         meta: 1,
//         dyf_submit: 1,
//         dyf_yes: 1,
//         dyf_no: 1,
//         views: 1,
//         visits: 1,
//         visitors: 1,
//         average_time_spent: { $ifNull: [{ $round: ['$average_time_spent', 2] }, 0] },
//         bouncerate: { $ifNull: [{ $round: ['$bouncerate', 2] }, 0] },
//         rap_initiated: 1,
//         rap_completed: 1,
//         nav_menu_initiated: 1,
//         rap_cant_find: 1,
//         rap_login_error: 1,
//         rap_other: 1,
//         rap_sin: 1,
//         rap_info_missing: 1,
//         rap_securekey: 1,
//         rap_other_login: 1,
//         rap_gc_key: 1,
//         rap_info_wrong: 1,
//         rap_spelling: 1,
//         rap_access_code: 1,
//         rap_link_not_working: 1,
//         rap_404: 1,
//         rap_blank_form: 1,
//         fwylf_cant_find_info: 1,
//         fwylf_other: 1,
//         fwylf_hard_to_understand: 1,
//         fwylf_error: 1,
//         visits_geo_ab: 1,
//         visits_geo_bc: 1,
//         visits_geo_mb: 1,
//         visits_geo_nb: 1,
//         visits_geo_nl: 1,
//         visits_geo_ns: 1,
//         visits_geo_nt: 1,
//         visits_geo_nu: 1,
//         visits_geo_on: 1,
//         visits_geo_outside_canada: 1,
//         visits_geo_pe: 1,
//         visits_geo_qc: 1,
//         visits_geo_sk: 1,
//         visits_geo_us: 1,
//         visits_geo_yt: 1,
//         visits_referrer_other: 1,
//         visits_referrer_searchengine: 1,
//         visits_referrer_social: 1,
//         visits_referrer_typed_bookmarked: 1,
//         visits_device_other: 1,
//         visits_device_desktop: 1,
//         visits_device_mobile: 1,
//         visits_device_tablet: 1,
//         gsc_total_clicks: 1,
//         gsc_total_ctr: { $ifNull: [{ $round: ['$gsc_total_ctr', 2] }, 0] },
//         gsc_total_impressions: { $ifNull: [{ $round: ['$gsc_total_impressions', 2] }, 0] },
//         gsc_total_position: { $ifNull: [{ $round: ['$gsc_total_position', 2] }, 0] },
//         gsc_searchterms: {
//           $cond: {
//             if: {
//               $eq: [{ $size: { $ifNull: ['$gsc_searchterms', []] } }, 0],
//             },
//             then: '$$REMOVE',
//             else: {
//               $map: {
//                 input: '$gsc_searchterms',
//                 as: 'searchterm',
//                 in: {
//                   clicks: '$$searchterm.clicks',
//                   ctr: { $round: ['$$searchterm.ctr', 2] },
//                   impressions: '$$searchterm.impressions',
//                   position: { $round: ['$$searchterm.position', 2] },
//                   term: '$$searchterm.term',
//                 },
//               },
//             },
//           },
//         },
//         aa_searchterms: {
//           $cond: {
//             if: {
//               $eq: [{ $size: { $ifNull: ['$aa_searchterms', []] } }, 0],
//             },
//             then: '$$REMOVE',
//             else: {
//               $map: {
//                 input: '$aa_searchterms',
//                 as: 'searchterm',
//                 in: {
//                   term: '$$searchterm.term',
//                   clicks: '$$searchterm.clicks',
//                   position: '$$searchterm.position',
//                 },
//               },
//             },
//           },
//         },
//       })
//       .pipeline();

//     pipeline.push({
//       $merge: {
//         into: 'temp_timeseries',
//         on: '_id',
//       }
//     } as PipelineStage);

//     const results = await db.collections.pageMetrics.aggregate(pipeline);

//     // logJson(results);

//     timer.logIteration(`Inserted metrics for ${date.toISOString().slice(0, 10)}`);
//   }
// };

export async function testHttp() {
  const test = await fetch('https://www.canada.ca/en/revenue-agency/services/tax/individuals/life-events/what-when-someone-died/final-return/complete-final-return-steps/common-types-income-a-final-return/federal-non-refundable-tax-credits/line-34900-donations-gifts.html')
    .then((res) => res.text());

  logJson(test)
}
