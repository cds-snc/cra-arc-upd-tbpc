import { DbService } from '@dua-upd/db';
import { Injectable } from '@nestjs/common';
import { Model, Types, isValidObjectId, type FilterQuery } from 'mongoose';
import type {
  CustomReportsFeedback,
  DbQuery,
  IFeedback,
  IPage,
  IProject,
  ITask,
} from '@dua-upd/types-common';
import { omit } from 'rambdax';
import { arrayToDictionary, getDateRange } from '@dua-upd/utils-common';

@Injectable()
export class QueryService {
  constructor(private db: DbService) {}

  async getData(serializedQueries: { [key: string]: string }) {
    const results: { [key: string]: unknown } = {};

    const lastWeekDateRange = getDateRange('week');

    for (const key in serializedQueries) {
      const query: DbQuery[keyof DbQuery] = JSON.parse(
        atob(serializedQueries[key]),
      );

      const { collection, filter, project, sort } = query;

      if (isValidObjectId(filter['_id'])) {
        filter['_id'] = new Types.ObjectId(filter['_id']);
      }

      const collectionModel = this.db.collections[collection] as Model<unknown>;

      // large queries on this collection can cripple the db, so we'll limit the results like this for now
      const limit = collection === 'pageMetrics' ? 1000 : undefined;

      if (collection === 'pages') {
        results[key] =
          (
            await this.db.views.pages.find(
              {
                dateRange: lastWeekDateRange,
              },
              { url: '$page.url', page: 1, title: '$page.title', visits: 1 },
              { sort: { visits: -1 } },
            )
          )?.map((page) => ({
            _id: page.page._id,
            ...omit(['_id', 'page'], page),
          })) || [];

        continue;
      }

      if (collection === 'feedback') {
        type FeedbackFilter = Omit<
          FilterQuery<IFeedback>,
          'page' | 'tasks' | 'projects'
        > & {
          page?: string[] | string;
          tasks?: string[] | string;
          projects?: string[] | string;
        };

        // just to have proper typing
        const feedbackFilter: FeedbackFilter = filter;

        const toFilter = <T extends 'page' | 'tasks' | 'projects'>(
          propName: T,
        ) => {
          const propFilter = feedbackFilter[propName];

          if (!propFilter) {
            return;
          }

          if (Array.isArray(propFilter)) {
            const filterArray = propFilter.map(
              (id: string) => new Types.ObjectId(id),
            );

            return { [propName]: { $in: filterArray } };
          }

          return { [propName]: new Types.ObjectId(propFilter) };
        };

        const pageFilters = toFilter('page');
        const tasksFilters = toFilter('tasks');
        const projectsFilters = toFilter('projects');

        type PropertyFilter =
          | {
              [prop: string]: {
                $in: Types.ObjectId[];
              };
            }
          | {
              [prop: string]: Types.ObjectId;
            };

        const pageTaskProjectFilters = [
          pageFilters,
          tasksFilters,
          projectsFilters,
        ].filter((f) => f) as PropertyFilter[];

        const restFilter = omit(['page', 'tasks', 'projects'], feedbackFilter);

        const queryFilter: Omit<
          FilterQuery<IFeedback>,
          'page' | 'tasks' | 'projects'
        > & {
          page?: PropertyFilter;
          tasks?: PropertyFilter;
          projects?: PropertyFilter;
        } = {
          ...restFilter,
          ...(pageTaskProjectFilters.length
            ? { $or: pageTaskProjectFilters }
            : {}),
        };

        const pages: Pick<IPage, '_id' | 'title' | 'url'>[] =
          await this.db.collections.pages
            .find({}, { title: 1, url: 1 })
            .lean()
            .exec();

        const tasks: Pick<ITask, '_id' | 'title' | 'pages'>[] =
          await this.db.collections.tasks
            .find({}, { title: 1, pages: 1 })
            .lean()
            .exec();

        const projects: Pick<IProject, '_id' | 'title' | 'pages'>[] =
          await this.db.collections.projects
            .find({}, { title: 1, pages: 1 })
            .lean()
            .exec();

        const pagesDict = arrayToDictionary(pages, '_id');
        const tasksDict = arrayToDictionary(tasks, '_id');
        const projectsDict = arrayToDictionary(projects, '_id');

        const defaultProjection = {
          _id: 1,
          url: 1,
          date: 1,
          comment: 1,
          page: 1,
          tasks: 1,
          projects: 1,
        };

        const feedback: Pick<IFeedback, keyof typeof defaultProjection>[] =
          await this.db.collections.feedback
            .find(queryFilter, project || defaultProjection, { limit })
            .sort(sort)
            .lean()
            .exec();

        // to make dealing with these easier, make the filters an array in all cases
        const toUnifiedFormat = <T extends 'page' | 'tasks' | 'projects'>(
          propName: T,
        ): string[] => {
          const propFilter = feedbackFilter[propName];

          if (!propFilter) {
            return [];
          }

          if (Array.isArray(propFilter)) {
            return propFilter;
          }

          return [propFilter];
        };

        const pageFilter = toUnifiedFormat('page');

        const selectedPages: CustomReportsFeedback['selectedPages'] =
          pageFilter.map((pageId: string) =>
            pagesDict[pageId]
              ? { ...pagesDict[pageId], _id: pagesDict[pageId].toString() }
              : { _id: '', title: '' },
          );

        const tasksFilter = toUnifiedFormat('tasks');

        const selectedTasks: CustomReportsFeedback['selectedTasks'] =
          tasksFilter.map((taskId: string) => {
            const task = tasksDict[taskId];
            if (!task) {
              return { _id: '', title: '', pages: [] };
            }

            const pages = task.pages?.map((_id) => _id.toString()) || [];

            return {
              ...task,
              _id: task._id.toString(),
              pages,
            };
          });

        const projectsFilter = toUnifiedFormat('projects');

        const selectedProjects: CustomReportsFeedback['selectedProjects'] =
          projectsFilter.map((projectId: string) => {
            const project = projectsDict[projectId];

            if (!project) {
              return { _id: '', title: '', pages: [] };
            }

            const pages = project.pages?.map((_id) => _id.toString()) || [];

            return {
              ...project,
              _id: project._id.toString(),
              pages,
            };
          });

        const feedbackWithTitles = feedback.map((comment) => {
          const tasks = comment.tasks || [];
          const projects = comment.projects || [];

          const taskTitles = tasks.map(
            (_id) => tasksDict[_id.toString()]?.title || '',
          );

          const projectTitles = projects.map(
            (_id) => projectsDict[_id.toString()]?.title || '',
          );

          return {
            ...omit(['page', 'tasks', 'projects'], comment),
            taskTitles,
            projectTitles,
          };
        });

        results[key] = {
          comments: feedbackWithTitles,
          selectedPages,
          selectedTasks,
          selectedProjects,
        } satisfies CustomReportsFeedback;

        continue;
      }

      results[key] = await collectionModel
        .find(filter, project, { limit })
        .sort(sort)
        .lean()
        .exec();
    }

    return results;
  }
}
