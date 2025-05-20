import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// need mongo import or TS will complain about missing types
import type { Document, FilterQuery, mongo } from 'mongoose';
import { Schema as MSchema, Types } from 'mongoose';
import type { IProject, ITask, IUxTest } from '@dua-upd/types-common';
import {
  type ModelWithStatics,
  arrayToDictionary,
} from '@dua-upd/utils-common';

export type PageDocument = Page & Document;

@Schema()
export class Page {
  @Prop({ type: MSchema.Types.ObjectId, required: true })
  _id: Types.ObjectId = new Types.ObjectId();

  @Prop({ required: true, type: String, index: true, unique: true })
  url: string;

  @Prop({ required: true, type: String })
  title = '';

  @Prop({ type: String })
  airtable_id?: string;

  @Prop({ type: String })
  lang?: 'en' | 'fr';

  @Prop({ type: String })
  altLangHref?: string;

  @Prop({ type: String })
  redirect?: string;

  @Prop({ type: Boolean })
  is_404?: boolean;

  @Prop({ type: Object })
  metadata?: { [prop: string]: string | Date };

  @Prop({ type: String, index: true })
  owners?: string;

  @Prop({ type: String, index: true })
  sections?: string;

  @Prop({ type: Date })
  lastChecked?: Date;

  @Prop({ type: Date })
  lastModified?: Date;

  @Prop({ type: [{ type: MSchema.Types.ObjectId, ref: 'Task' }] })
  tasks?: Types.ObjectId[] | ITask[];

  @Prop({ type: [{ type: MSchema.Types.ObjectId, ref: 'Project' }] })
  projects?: Types.ObjectId[] | IProject[];

  @Prop({ type: [{ type: MSchema.Types.ObjectId, ref: 'UxTest' }] })
  ux_tests?: Types.ObjectId[] | IUxTest[];

  // overloads
  static mergePages<T extends object>(
    this: PageModel,
    data: T[],
    options: MergePagesOptions<T>,
  ): Promise<(Page & T)[]>;
  static mergePages<T extends object>(
    this: PageModel,
    data: T[],
    options: MergePagesOptions<T> & { returnAsPairs: true },
  ): Promise<[Page, T][]>;

  static async mergePages<T extends object>(
    this: PageModel,
    data: T[],
    options: MergePagesOptions<T>,
  ) {
    if (!options.defaultValues && !options.noDefaults) {
      throw new Error(
        'Must provide either defaultValues or set noDefaults=true',
      );
    }

    const pages = await this.find(
      options.filter || {},
      options.projection || {},
    )
      .lean()
      .exec();

    if (options.noDefaults) {
      const pagesDict = arrayToDictionary(pages, options.pagesJoinProp);

      const getPage = (record: T): Page | undefined =>
        pagesDict[record[options.dataJoinProp] as string];

      if (options.returnAsPairs) {
        return data.map((record) => [getPage(record), record]) as [Page, T][];
      }

      return data
        .map((record) => ({
          ...getPage(record),
          ...record,
        }))
        .filter((page) => page._id) as (Page & T)[];
    }

    const dataDict = arrayToDictionary(data, options.dataJoinProp);

    const getRecord = (page: Page): Omit<T, keyof Page> | undefined =>
      dataDict[page[options.pagesJoinProp] as string] || options.defaultValues;

    if (options.returnAsPairs) {
      return pages.map((page) => [page, getRecord(page)]) satisfies [
        Page,
        Omit<T, keyof Page>,
      ][];
    }

    return pages.map((page) => ({
      ...page,
      ...getRecord(page),
    }));
  }
}

export const PageSchema = SchemaFactory.createForClass(Page);

const statics = {
  mergePages: Page.mergePages,
};

PageSchema.statics = statics;

export type PageModel = ModelWithStatics<Page, typeof statics>;

export type MergePagesOptions<T> = {
  dataJoinProp: keyof T;
  pagesJoinProp: keyof Page;
  projection?: { [key in keyof Page]?: 0 | 1 };
  filter?: FilterQuery<Page>;
  defaultValues?: Omit<T, keyof Page>;
  returnAsPairs?: true;
  // Don't include pages with no results
  noDefaults?: boolean;
};
