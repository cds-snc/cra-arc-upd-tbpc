import type { IStorageModel } from '@dua-upd/blob-storage';
import { wait } from '@dua-upd/utils-common';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Document,
  FilterQuery,
  Model,
  ProjectionType,
  Schema as MSchema,
  Types,
} from 'mongoose';
import type { IUrl, UrlHash } from '@dua-upd/types-common';

export type UrlDocument = Url & Document;

export type MapBlobsFunc = (url: IUrl & { blobContent: string }) => unknown;

export type MapBlobsArgs<T extends MapBlobsFunc> =
  | [FilterQuery<Url>, ProjectionType<Url>, T]
  | [FilterQuery<Url>, T]
  | [T];

@Schema({ collection: 'urls' })
export class Url implements IUrl {
  @Prop({ type: MSchema.Types.ObjectId, required: true })
  _id = new Types.ObjectId();

  @Prop({ type: String, required: true, unique: true })
  url: string;

  @Prop({ type: String, index: true })
  title?: string;

  @Prop({ type: [String], index: true })
  all_titles?: string[];

  @Prop({ type: MSchema.Types.ObjectId, sparse: true })
  page?: Types.ObjectId;

  @Prop({ type: Object })
  metadata?: { [prop: string]: string | Date };

  @Prop({ type: Object })
  langHrefs?: {
    en?: string;
    fr?: string;
    [prop: string]: string | undefined;
  };

  @Prop({ type: [{ href: String, text: String }], _id: false })
  links?: { href: string; text: string }[];

  @Prop({ type: String, index: true })
  redirect?: string;

  @Prop({ type: Date, index: true })
  last_checked?: Date;

  @Prop({ type: Date, index: true })
  last_modified?: Date;

  @Prop({ type: Boolean, index: true })
  is_404?: boolean;

  @Prop({ type: [{ hash: String, date: Date }], _id: false })
  hashes?: UrlHash[];

  @Prop({ type: String, index: true })
  latest_snapshot?: string;

  static async mapBlobs<T extends MapBlobsFunc>(
    this: Model<Url>,
    blobClient: IStorageModel<any>,
    mapFunc: T,
  ): Promise<(ReturnType<T> | void)[]>;

  static async mapBlobs<T extends MapBlobsFunc>(
    this: Model<Url>,
    blobClient: IStorageModel<any>,
    filter: FilterQuery<Url>,
    mapFunc: T,
  ): Promise<(ReturnType<T> | void)[]>;

  static async mapBlobs<T extends MapBlobsFunc>(
    this: Model<Url>,
    blobClient: IStorageModel<any>,
    filter: FilterQuery<Url>,
    projection: ProjectionType<Url>,
    mapFunc: T,
  ): Promise<(ReturnType<T> | void)[]>;

  static async mapBlobs<T extends MapBlobsFunc>(
    this: Model<Url>,
    blobClient: IStorageModel<any>,
    ...args: MapBlobsArgs<T>
  ): Promise<(ReturnType<T> | void)[]> {
    const filter =
      args.length === 3 ? args[0] : args.length === 2 ? args[0] : {};
    const projection = args.length === 3 ? args[1] : {};
    const mapFunc = args[args.length - 1] as T;

    const urls = await this.find(filter, projection).lean().exec();

    const promises: Promise<ReturnType<T>>[] = [];

    for (const [i, url] of urls.entries()) {
      if (i % 15 === 0) {
        await wait(1);
      }

      const blob = blobClient.blob(url.latest_snapshot);

      if (!(await blob.exists())) {
        console.error(`Blob ${url.latest_snapshot} does not exist!`);

        continue;
      }

      const promise = blobClient
        .blob(url.latest_snapshot)
        .downloadToString()
        .then(
          (blobContent) =>
            mapFunc({ ...url, blobContent }) as Promise<ReturnType<T>>,
        );

      promises.push(promise);
    }

    return await Promise.all(promises);
  }
}

export const UrlSchema = SchemaFactory.createForClass(Url);

UrlSchema.index({ 'links.text': 1 });
UrlSchema.index({ 'links.href': 1 });
UrlSchema.index({ last_checked: -1 });
UrlSchema.index({ last_modified: -1 });
UrlSchema.index({ 'hashes.hash': 1 });
UrlSchema.index({ 'hashes.date': 1 });

UrlSchema.static('mapBlobs', Url.mapBlobs);

export type UrlModel = Model<Url> & {
  mapBlobs: typeof Url.mapBlobs;
};
