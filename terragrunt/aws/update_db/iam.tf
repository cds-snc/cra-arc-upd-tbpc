# ECS
locals {
  secrets_arns = [for secret in var.container_secrets : secret.valueFrom]
}

data "aws_iam_policy_document" "cra_upd_s3_update_db_readwrite_policy_doc" {
  statement {
    sid    = "AllowDataBucketReadWriteAccess"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:HeadObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListObjects",
      "s3:ListBucket",
    ]
    resources = [
      var.data_bucket_arn,
      "${var.data_bucket_arn}/*"
    ]
  }
}

data "aws_iam_policy_document" "cra_upd_ssm_update_db_read_policy_doc" {
  statement {
    sid    = "AllowSSMParameterAccess"
    effect = "Allow"
    actions = [
      "ssm:GetParameter*",
    ]
    resources = local.secrets_arns
  }
}

# Scheduler
data "aws_iam_policy_document" "scheduler_assume_role_policy" {
  statement {
    effect = "Allow"
    actions = [
      "sts:AssumeRole"
    ]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com", "scheduler.amazonaws.com"]
    }
    # Confused deputy prevention: https://docs.aws.amazon.com/scheduler/latest/UserGuide/cross-service-confused-deputy-prevention.html
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.account_id]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [aws_scheduler_schedule_group.update_db_schedule_group.arn]
    }
  }
}

resource "aws_iam_role" "scheduler_role" {
  name               = "${local.scheduler_name}-role"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume_role_policy.json
}

data "aws_iam_policy_document" "scheduler_role_policy" {
  statement {
    effect = "Allow"
    actions = [
      "ecs:RunTask"
    ]
    resources = [
      "${local.task_definition_arn_unversioned}*",
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "iam:PassRole"
    ]
    resources = [
      module.update_db_ecs.task_exec_role_arn,
      module.update_db_ecs.task_role_arn,
    ]
    condition {
      test     = "StringLike"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }

  statement {
    effect = "Allow"
    actions = [
      "sqs:SendMessage",
    ]
    resources = [aws_sqs_queue.scheduler_dlq.arn]
  }
}

resource "aws_iam_policy" "scheduler_role_policy" {
  name        = "${local.scheduler_name}-role-policy"
  description = "Policy for the scheduler role to run ECS tasks"
  policy      = data.aws_iam_policy_document.scheduler_role_policy.json
}

resource "aws_iam_role_policy_attachment" "scheduler_role_policy_attachment" {
  role       = aws_iam_role.scheduler_role.name
  policy_arn = aws_iam_policy.scheduler_role_policy.arn
}
