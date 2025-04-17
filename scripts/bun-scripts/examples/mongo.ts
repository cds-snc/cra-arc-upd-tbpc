import { getDb } from '../deps';

{
  // `using` keyword makes the connection close automatically
  //  when the reference goes out of scope
  await using db = await getDb();

  const page = await db.pages.findOne().lean().exec();

  const metric = await db.pageMetrics.findOne({ page: page._id }).lean().exec();


  console.log(page.title);
  console.log(JSON.stringify(metric, null, 2));
}
