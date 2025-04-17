import stopwordsEn from './stopwords_en.json';
import stopwordsFr from './stopwords_fr.json';
import lemmas from './lemmas.json';
import { IFeedback } from '@dua-upd/types-common';
import { squishTrim } from '@dua-upd/utils-common';

// todo: stucture all of this to support both languages
const contractionRegexesEn: [RegExp, string][] = [
  [/won't/g, 'will not'],
  [/can't/g, 'cannot'],
  [/i'm/g, 'i am'],
  [/\b(\w+)'ll/g, '$1 will'],
  [/\b(\w+)n't/g, '$1 not'],
  [/\b(\w+)'ve/g, '$1 have'],
  [/\b(\w+)'s/g, '$1 is'],
  [/\b(\w+)'re/g, '$1 are'],
  [/\b(\w+)'d/g, '$1 would'],
];

const acronymPatternsEn: [RegExp, string][] = [
  ['notice of assessment', 'NOA'],
  ['tax free savings account', 'TFSA'],
  ['registered retirement savings plan', 'RRSP'],
  ['registered education savings plan', 'RESP'],
  ['guaranteed investment certificate', 'GIC'],
  ['registered retirement income fund', 'RRIF'],
  ['disability tax credit', 'DTC'],
  ['canada pension plan', 'CPP'],
  ['climate action incentive', 'CAI'],
  ['old age security pension', 'OAS'],
  ['old age security', 'OAS'],
  ['old age pension', 'OAS'],
  ['direct deposit', 'DD'],
  // todo: add more
].map(([phrase, acronym]) => [new RegExp(`\\b${phrase}\\b`, 'g'), acronym]);

const acronymsEn = [
  ...acronymPatternsEn.map(([, acronym]) => acronym),
  ...[
    'ab',
    'bc',
    'mb',
    'nb',
    'nl',
    'ns',
    'nt',
    'nu',
    'on',
    'pe',
    'qc',
    'sk',
    'yt',
  ],
];

const acronymPatternsFr: [RegExp, string][] = []; // todo

const acronymsFr: string[] = [
  // todo
  ...acronymPatternsFr.map(([, acronym]) => acronym),
];

const remove = [
  '\\?',
  '!',
  '\\(',
  '\\)',
  '\\.+',
  '\\,',
  '"',
  '・',
  '#{2,}',
  '[\\d\\-/]{5,}',
  '“|”|‘|’|`',
  "\\b'|'\\b",
  '\\s-|-\\s',
  ':',
  '�',
].join('|');

const cleaningPatterns: [RegExp, string][] = [
  [/—/g, '-'],
  [/\$\s*\d+(?:[,.]\\d+)*|\\d+(?:[,.]\d+)*\s*\$/g, ' '], // dollar amounts
  [new RegExp(remove, 'g'), ' '],
  [/\d{5,}/g, ' '], // numbers with 5 or more digits
  [/\s+/g, ' '], // squish whitespace
  [/([a-z])\1{2,}/gi, '$1'], // repeating characters
  ...contractionRegexesEn,
  ...acronymPatternsEn,
];

const spamRegexes = new RegExp(
  '<a .+?</a>' +
    '|We want to advertise on your website' +
    '|\\[url=+?[/url]' +
    '|gohighlevel' +
    '|ly/infinityflow' +
    '|https://rebrand' +
    '|https://gorspillsd',
  'i',
);

const shouldSkip = (comment: IFeedback) =>
  !comment.comment ||
  !['en', 'fr'].includes(comment.lang.toLowerCase()) ||
  spamRegexes.test(comment.comment) ||
  !/\p{Script_Extensions=Latin}|^\s*[\d\p{Emoji_Presentation}]+\s*$/u.test(
    comment.comment,
  );

const cleanComment = (
  comment: string,
  patterns: [RegExp, string][] = cleaningPatterns,
) => {
  let cleanComment = `${comment.toLowerCase()}`;

  for (const [pattern, replacement] of patterns) {
    cleanComment = cleanComment.replaceAll(pattern, replacement);
  }

  return squishTrim(cleanComment.toLowerCase());
};

// skip words that are entirely non-alphanumeric (unless an emoji)
const nonAlphaNumericPattern = /^[^a-z0-9\p{Emoji_Presentation}]+$/iu;

export function preprocessCommentWords(comments: IFeedback[]) {
  const stopwordSets = {
    en: new Set(stopwordsEn),
    fr: new Set(stopwordsFr),
  };

  const acronyms = {
    en: new Set(acronymsEn),
    fr: new Set(acronymsFr),
  };

  for (const comment of comments) {
    if (shouldSkip(comment)) continue;

    const lang = comment.lang.toLowerCase() as 'en' | 'fr';

    const stopwords = stopwordSets[lang];

    const cleaned = cleanComment(comment.comment); // fix this for langs

    const words = cleaned
      .split(' ')
      .filter(
        (word) =>
          !nonAlphaNumericPattern.test(word) &&
          !stopwords.has(word) &&
          (word.length > 2 ||
            acronyms[lang].has(word) ||
            /\p{Emoji_Presentation}/u.test(word)),
      );

    if (words.length === 0) {
      continue;
    }

    const lemmatized =
      lang === 'en'
        ? words.map((word) => (<Record<string, string>>lemmas)[word] || word)
        : words;

    comment.words = lemmatized;
  }

  return comments;
}

// Keep the polars code for now in case we need it I guess
// import {
//   col,
//   DataFrame,
//   element,
//   Expr,
//   Int8,
//   lit,
//   select,
//   readJSON,
//   type ReadJsonOptions,
// } from 'nodejs-polars';
// import { piped } from 'rambdax';

// const acronymsDf = toDataframe(
//   acronymsEn.map((acronym, i) => ({
//     en: acronym,
//     fr: acronymsFr[i] || null,
//   })),
// );

// function addReplaceExprs(
//   columnExpr = col('comment'),
//   patterns: [RegExp, string][] = cleaningPatterns,
// ) {
//   let expr = columnExpr;

//   for (const [pattern, repl] of patterns) {
//     expr = expr.str.replaceAll(pattern, repl);
//   }

//   return expr;
// }

// function cleanComments(df: DataFrame, lang: 'en' | 'fr' = 'en'): DataFrame {
//   return df
//     .filter(
//       col('lang')
//         .eq(lit(lang.toUpperCase()))
//         .and(col('comment').isNotNull())
//         .and(col('comment').str.lengths().gt(0)),
//     )
//     .filter(
//       // ignore spam
//       col('comment')
//         .str.contains(spamRegexes)
//         .not()
//         .and(
//           // ignore comments with no Latin characters (but keep if only numbers or emojis)
//           col('comment').str.contains(
//             /\p{Script_Extensions=Latin}|^\s*[\d\p{Emoji_Presentation}]+\s*$/u,
//           ),
//         ),
//     )
//     .withColumn(
//       addReplaceExprs(col('comment').str.toLowerCase())
//         .str.toLowerCase()
//         .str.strip()
//         .alias('cleaned'),
//     );
// }

// const addYearMonthWeek = (df: DataFrame) =>
//   df.withColumns(
//     col('date').date.year().alias('year'),
//     col('date').date.month().alias('month'),
//     col('date').date.day().div(7).ceil().cast(Int8).alias('week_of_month'),
//   );

// const stopWords = {
//   en: toDataframe(stopwordsEn).getColumn('en'),
//   fr: toDataframe(stopwordsFr).getColumn('fr'),
// };

// function tokenize(df: DataFrame, lang: 'en' | 'fr' = 'en'): DataFrame {
//   return df
//     .withColumns(col('cleaned').str.split(' ').alias('all_words'))
//     .withColumns(
//       col('all_words')
//         .lst.eval(
//           element().filter(
//             element()
//               .isIn(stopWords[lang])
//               .not()
//               .and(
//                 element()
//                   .str.lengths()
//                   .gt(2)
//                   .or(element().isIn(acronymsDf.getColumn(lang))),
//               ),
//           ),
//         )
//         .alias('words'),
//     )
//     .filter(col('words').lst.lengths().gt(lit(0)));
// }

// // I think `piped` is swallowing errors, so will need to handle that
// export function preprocess(df: DataFrame, lang: 'en' | 'fr' = 'en'): DataFrame {
//   return piped(
//     df,
//     (df: DataFrame) => cleanComments(df, lang),
//     (df: DataFrame) => addYearMonthWeek(df),
//     (df: DataFrame) => tokenize(df, lang),
//   );
// }
