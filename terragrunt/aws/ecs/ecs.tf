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
      {
        name  = "COMPRESS_RESPONSES",
        value = "true"
      }
    ],
    var.env == "production" ? [
      {
        name  = "NODE_OPTIONS"
        value = "--max-old-space-size=8192"
      },
    ] : [],
    var.environment
  )
}

module "api_ecs" {
  source = "github.com/cds-snc/terraform-modules//ecs?ref=v10.4.4"

  cluster_name = "${var.product_name}-cluster"
  service_name = "${var.product_name}-app-service"

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
  container_cpu                       = var.ecs_cpu
  container_memory                    = var.ecs_memory
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
  lb_target_group_arn = var.loadbalancer_target_group_arn

  # Use a single subnet if instance count is 1, otherwise the load balancer will have networking issues
  subnet_ids = var.ecs_instance_count == 1 ? [var.vpc_private_subnet_ids[0]] : var.vpc_private_subnet_ids

  security_group_ids = [
    aws_security_group.cra_upd_ecs_sg.id,
    var.loadbalancer_egress_sg_id,
    var.docdb_egress_sg_id,
    var.elasticache_egress_sg_id
  ]

  billing_tag_value = var.billing_tag_value
}

resource "aws_cloudwatch_log_group" "cra_upd_cloudwatch_group" {
  name              = "/aws/ecs/${var.product_name}-cluster"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_stream" "cra_upd_cloudwatch_stream" {
  name           = "${var.product_name}-log-stream"
  log_group_name = aws_cloudwatch_log_group.cra_upd_cloudwatch_group.name
}