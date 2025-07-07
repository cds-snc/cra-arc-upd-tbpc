locals {
  container_environment = concat(
    [
      {
        name  = "DB_HOST"
        value = var.docdb_endpoint
      },
      {
        name  = "DB_TLS_CA_FILE",
        value = "/etc/ssl/global-bundle.pem"
      },
      {
        name  = "REDIS_HOST"
        value = var.elasticache_endpoint
      },
      {
        name  = "DATA_BUCKET_NAME"
        value = var.data_bucket_name
      },
    ],
    var.environment
  )
}

module "api_ecs" {
  source = "github.com/cds-snc/terraform-modules//ecs?ref=v10.4.4"

  cluster_name = "${var.product_name_dashed}-cluster"
  service_name = "${var.product_name_dashed}-app-service"

  task_cpu    = var.ecs_cpu
  task_memory = var.ecs_memory

  # This causes the service to always use the latest ACTIVE task definition.
  # This gives precedence to the repo's CI/CD task deployments
  # and prevents the Terraform from undoing deployments.
  service_use_latest_task_def = true


  # Scaling
  enable_autoscaling       = true
  desired_count            = 1
  autoscaling_min_capacity = 1
  autoscaling_max_capacity = 1

  # Task definition
  container_image                     = "${var.ecr_repository_url}:latest"
  container_host_port                 = 9000
  container_port                      = 9000
  container_environment               = local.container_environment
  container_secrets                   = var.container_secrets
  container_read_only_root_filesystem = false
  container_health_check = {
    "command" : [
      "CMD-SHELL",
      "curl -f http://localhost:9000/api/_healthcheck || exit 1"
    ],
    "interval" : 60,
    "timeout" : 30,
    "retries" : 3,
    "startPeriod" : 60
  }

  task_role_policy_documents = [
    data.aws_iam_policy_document.cra_upd_s3_data_read_policy_doc.json,
  ]

  task_exec_role_policy_documents = [
    data.aws_iam_policy_document.cra_upd_ssm_read_policy_doc.json
  ]

  # Forward logs to Sentinel?
  # sentinel_forwarder           = true
  # sentinel_forwarder_layer_arn = "arn:aws:lambda:ca-central-1:283582579564:layer:aws-sentinel-connector-layer:199"

  # Networking
  lb_target_group_arn = aws_lb_target_group.cra_upd_ecs_lb_target_group.arn
  subnet_ids          = var.vpc_private_subnet_ids
  security_group_ids  = [aws_security_group.cra_upd_ecs_sg.id, var.docdb_egress_sg_id, var.elasticache_egress_sg_id]

  billing_tag_value = var.billing_tag_value

  depends_on = [aws_lb_listener.cra_upd_ecs_alb_listener]
}

resource "aws_cloudwatch_log_group" "cra_upd_cloudwatch_group" {
  name              = "/aws/ecs/${var.product_name_dashed}-cluster"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_stream" "cra_upd_cloudwatch_stream" {
  name           = "${var.product_name_dashed}-log-stream"
  log_group_name = aws_cloudwatch_log_group.cra_upd_cloudwatch_group.name
}