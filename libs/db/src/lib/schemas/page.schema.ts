import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// need mongo import or TS will complain about missing types
import type { Document, FilterQuery, mongo } from 'mongoose';
import { Schema as MSchema, Types } from 'mongoose';
import type { IProject, ITask, IUxTest } from '@dua-upd/types-common';
import {
  type KeysOfType,
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
  static mergePages<
    T extends object,
    PageProjection extends { _id: Types.ObjectId } = Page,
  >(
    this: PageModel,
    data: T[],
    options: MergePagesOptions<T, PageProjection> & { returnAsPairs: true },
  ): Promise<[PageProjection, T][]>;
  static mergePages<
    T extends object,
    PageProjection extends { _id: Types.ObjectId } = Page,
  >(
    this: PageModel,
    data: T[],
    options: MergePagesOptions<T, PageProjection>,
  ): Promise<(PageProjection & T)[]>;

  static async mergePages<
    T extends object,
    PageProjection extends { _id: Types.ObjectId } = Page,
  >(this: PageModel, data: T[], options: MergePagesOptions<T, PageProjection>) {
    if (!options.defaultValues && !options.noDefaults) {
      throw new Error(
        'Must provide either defaultValues or set noDefaults=true',
      );
    }

    const pages = await this.find(
      options.filter || {},
      options.projection || {},
    )
      .lean<PageProjection[]>()
      .exec();

    if (options.noDefaults) {
      const pagesDict = arrayToDictionary(pages, options.pagesJoinProp);

      const getPage = (record: T): PageProjection | undefined =>
        pagesDict[record[options.dataJoinProp as string]];

      if (options.returnAsPairs) {
        return data.map((record) => [getPage(record), record]) as [
          PageProjection,
          T,
        ][];
      }

      return data
        .map((record) => ({
          ...getPage(record),
          ...record,
        }))
        .filter((page) => page._id) as (PageProjection & T)[];
    }

    const dataDict = arrayToDictionary(data, options.dataJoinProp as keyof T);

    const getRecord = (
      page: PageProjection,
    ): Omit<T, keyof PageProjection> | undefined =>
      dataDict[page[options.pagesJoinProp] as string] || options.defaultValues;

    if (options.returnAsPairs) {
      return pages.map((page) => [page, getRecord(page)]) satisfies [
        PageProjection,
        Omit<T, keyof PageProjection>,
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

export type MergePagesOptions<T, PageProjection extends object = Page> = {
  dataJoinProp: KeysOfType<PageProjection, string>;
  pagesJoinProp: KeysOfType<PageProjection, string>;
  projection?: { [key in keyof Page]?: 0 | 1 };
  filter?: FilterQuery<Page>;
  defaultValues?: Omit<T, keyof PageProjection>;
  returnAsPairs?: true;
  // Don't include pages with no results
  noDefaults?: boolean;
};
