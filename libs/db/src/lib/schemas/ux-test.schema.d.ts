/// <reference types="mongoose/types/pipelinestage" />
/// <reference types="mongoose/types/connection" />
/// <reference types="mongoose/types/cursor" />
/// <reference types="mongoose/types/document" />
/// <reference types="mongoose/types/error" />
/// <reference types="mongoose/types/mongooseoptions" />
/// <reference types="mongoose/types/schemaoptions" />
import { Document, Model, Types } from 'mongoose';
import { Page } from './page.schema';
import { Project } from './project.schema';
import { Task } from './task.schema';
export declare type UxTestDocument = UxTest & Document;
export declare class UxTest {
  _id: Types.ObjectId;
  title: string;
  airtable_id: string;
  project: Types.ObjectId | Project;
  pages?: Types.ObjectId[] | Page[];
  tasks?: Types.ObjectId[] | Task[];
  subtask?: string;
  date?: Date;
  success_rate?: number;
  test_type?: string;
  session_type?: string;
  scenario?: string;
  vendor?: string;
  version_tested?: string;
  github_repo?: string;
  total_users?: number;
  successful_users?: number;
  program?: string;
  branch?: string;
  project_lead?: string;
  launch_date?: Date;
  status?: string;
  cops?: boolean;
  wos_cops?: boolean;
  attachments?: string[];
}
export declare const UxTestSchema: import('mongoose').Schema<
  Document<UxTest, any, any>,
  Model<Document<UxTest, any, any>, any, any, any>,
  {},
  {}
>;
export declare function getUxTestModel(): Model<Document<UxTest>>;
