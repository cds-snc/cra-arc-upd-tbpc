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
        name  = "DATA_BUCKET_NAME"
        value = var.data_bucket_name
      },
      {
        name = "ENV"
        value = var.env
      }
    ],
    var.environment
  )
}

module "update_db_ecs" {
  source = "github.com/cds-snc/terraform-modules//ecs?ref=v10.5.2"

  cluster_name = "${var.product_name}-update-db-cluster"
  service_name = "${var.product_name}-update-db-service"

  task_cpu    = var.update_db_ecs_cpu
  task_memory = var.update_db_ecs_memory

  service_use_latest_task_def = true

  # Scaling
  enable_autoscaling = false
  desired_count      = 0

  # Task definition
  container_image                     = "${var.ecr_update_db_repository_url}:latest"
  container_environment               = local.container_environment
  container_secrets                   = var.container_secrets
  container_read_only_root_filesystem = false

  task_role_policy_documents = [
    data.aws_iam_policy_document.cra_upd_s3_update_db_readwrite_policy_doc.json,
  ]

  task_exec_role_policy_documents = [
    data.aws_iam_policy_document.cra_upd_ssm_update_db_read_policy_doc.json,
  ]

  # Forward logs to Sentinel?
  # sentinel_forwarder           = true
  # sentinel_forwarder_layer_arn = "arn:aws:lambda:ca-central-1:283582579564:layer:aws-sentinel-connector-layer:199"

  subnet_ids         = var.vpc_private_subnet_ids
  security_group_ids = local.update_db_security_groups

  billing_tag_value = var.billing_tag_value
}
