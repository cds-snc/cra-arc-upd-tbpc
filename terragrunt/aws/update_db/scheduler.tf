resource "aws_scheduler_schedule_group" "update_db_schedule_group" {
  name = "${local.scheduler_name}-group"
}

resource "aws_scheduler_schedule" "update_db_schedule" {
  name       = local.scheduler_name
  group_name = aws_scheduler_schedule_group.update_db_schedule_group.name
  
  schedule_expression          = var.schedule_cron_expression
  schedule_expression_timezone = "America/New_York"

  # Configure the schedule to be enabled
  state = "ENABLED"

  # Flexible time window (optional)
  flexible_time_window {
    mode = "OFF"
  }

  # Target configuration for ECS task
  target {
    arn      = module.update_db_ecs.arn
    role_arn = aws_iam_role.scheduler_role.arn

    ecs_parameters {
      task_definition_arn = local.task_definition_arn_unversioned # Unversioned ARN defaults to latest revision
      launch_type         = "FARGATE"
      task_count          = 1
      network_configuration {
        subnets          = var.vpc_private_subnet_ids
        security_groups  = local.update_db_security_groups
        assign_public_ip = false
      }
    }

    # Retry policy
    retry_policy {
      maximum_retry_attempts       = 0
      maximum_event_age_in_seconds = 3600
    }

    # Dead letter queue configuration
    # todo: Set this up to send slack notifications or some other alerting mechanism
    dead_letter_config {
      arn = aws_sqs_queue.scheduler_dlq.arn
    }
  }
}

# Dead Letter Queue for failed schedule executions
resource "aws_sqs_queue" "scheduler_dlq" {
  name                      = "${local.scheduler_name}-dlq"
  message_retention_seconds = 1209600 # 14 days
}

