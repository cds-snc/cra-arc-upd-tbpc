import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MSchema, Types } from 'mongoose';
import type {
  CallsByTopic,
  DateRange,
  GscSearchTermMetrics,
  IPageView,
  IProject,
  ITask,
  ITaskView,
  IUxTest,
} from '@dua-upd/types-common';
import type { ModelWithStatics } from '@dua-upd/utils-common/types';

@Schema({ collection: 'view_tasks' })
export class TasksView implements ITaskView {
  @Prop({ type: MSchema.Types.ObjectId, required: true })
  _id: Types.ObjectId = new Types.ObjectId();

  @Prop({
    required: true,
    type: { start: Date, end: Date },
    index: true,
    _id: false,
  })
  dateRange: DateRange<Date>;

  @Prop({
    type: {
      _id: MSchema.Types.ObjectId,
      title: String,
      title_fr: String,
      group: String,
      subgroup: String,
      topic: String,
      subtopic: String,
      sub_subtopic: [String],
      user_type: [String],
      tpc_ids: [Number],
      program: String,
      service: String,
      user_journey: [String],
      status: String,
      channel: [String],
      core: [String],
      portfolio: String,
      gc_tasks: [
        {
          _id: String,
          airtable_id: String,
          title: String,
          title_fr: String,
          date_mapped: Date,
        },
      ],
    },
  })
  task: ITask;

  @Prop({ type: Number })
  totalCalls: number;

  @Prop({ type: [{ enquiry_line: String, calls: Number }], _id: false })
  calldriversEnquiry: { enquiry_line: string; calls: number }[];

  @Prop({
    type: [
      {
        tpc_id: Number,
        enquiry_line: String,
        topic: String,
        subtopic: String,
        sub_subtopic: String,
        calls: Number,
      },
    ],
    _id: false,
  })
  callsByTopic: CallsByTopic[];

  @Prop({ type: Number })
  callsPerVisit: number | null;

  @Prop({ type: Number })
  dyfNo: number;

  @Prop({ type: Number })
  dyfNoPerVisit: number | null;

  @Prop({ type: Number })
  dyfYes: number;

  @Prop({ type: Number })
  visits: number;

  @Prop({ type: Number })
  gscTotalClicks: number;

  @Prop({ type: Number })
  gscTotalImpressions: number;

  @Prop({ type: Number })
  gscTotalCtr: number;

  @Prop({ type: Number })
  gscTotalPosition: number;

  @Prop({ type: Number })
  survey: number;

  @Prop({ type: Number })
  survey_completed: number;

  @Prop({ type: Number })
  tmf_ranking_index: number;

  @Prop({ type: Boolean })
  cops: boolean;

  @Prop({ type: Number })
  numComments: number;

  @Prop({
    type: [{ term: String, clicks: Number, position: Number }],
    _id: false,
  })
  aa_searchterms?: {
    term: string;
    clicks: number;
    position: number;
  }[];

  @Prop({
    type: [
      {
        clicks: Number,
        ctr: Number,
        impressions: Number,
        position: Number,
        term: String,
      },
    ],
  })
  gsc_searchterms?: GscSearchTermMetrics[];

  @Prop({
    type: [
      {
        date: String,
        calls: Number,
        callsPerVisit: Number,
        dyfNo: Number,
        dyfNoPerVisit: Number,
        dyfYes: Number,
        numComments: Number,
        commentsPerVisit: Number,
        visits: Number,
      },
    ],
    _id: false,
  })
  metricsByDay: {
    date: string;
    calls: number;
    callsPerVisit: number | null;
    dyfNo: number;
    dyfNoPerVisit: number | null;
    dyfYes: number;
    numComments: number;
    commentsPerVisit: number | null;
    visits: number;
  }[];

  @Prop({
    type: [
      {
        _id: MSchema.Types.ObjectId,
        page: {
          _id: MSchema.Types.ObjectId,
          url: String,
          title: String,
          lang: String,
          redirect: String,
          owners: String,
          sections: String,
        },
        pageStatus: String,
        visits: Number,
        dyf_yes: Number,
        dyf_no: Number,
        numComments: Number,
        gsc_total_clicks: Number,
        gsc_total_impressions: Number,
        gsc_total_ctr: Number,
        gsc_total_position: Number,
      },
    ],
    required: true,
  })
  pages: Pick<
    IPageView,
    | '_id'
    | 'page'
    | 'pageStatus'
    | 'visits'
    | 'dyf_yes'
    | 'dyf_no'
    | 'numComments'
    | 'gsc_total_clicks'
    | 'gsc_total_impressions'
    | 'gsc_total_ctr'
    | 'gsc_total_position'
  >[];

  @Prop({
    type: [
      {
        _id: MSchema.Types.ObjectId,
        title: String,
        airtable_id: String,
        project: MSchema.Types.ObjectId,
        subtask: String,
        date: Date,
        success_rate: Number,
        test_type: String,
        session_type: String,
        scenario: String,
        vendor: String,
        version_tested: String,
        github_repo: String,
        total_users: Number,
        successful_users: Number,
        program: String,
        branch: String,
        project_lead: String,
        launch_date: Date,
        status: String,
        cops: Boolean,
        attachments: [
          {
            id: String,
            url: String,
            filename: String,
            size: Number,
            storage_url: String,
          },
        ],
      },
    ],
  })
  ux_tests?: Omit<IUxTest, 'pages' | 'tasks' | 'projects'>[];

  @Prop({
    type: [
      {
        _id: MSchema.Types.ObjectId,
        title: String,
        description: String,
        attachments: [
          {
            id: String,
            url: String,
            filename: String,
            size: Number,
            storage_url: String,
          },
        ],
      },
    ],
  })
  projects?: Omit<IProject, 'pages' | 'tasks' | 'ux_tests'>[];

  @Prop({ type: Date, required: true, default: () => new Date(), index: true })
  lastUpdated: Date;
}

export const TasksViewSchema = SchemaFactory.createForClass(TasksView);

TasksViewSchema.index({ dateRange: 1, 'task._id': 1 }, { unique: true });
TasksViewSchema.index({ dateRange: 1, 'projects._id': 1 });
TasksViewSchema.index({ 'task._id': 1 });
TasksViewSchema.index(
  { 'projects._id': 1 },
  { partialFilterExpression: { 'projects._id.0': { $exists: true } } },
);

const statics = {};

TasksViewSchema.statics = statics;

export type TasksViewModel = ModelWithStatics<TasksView, typeof statics>;
