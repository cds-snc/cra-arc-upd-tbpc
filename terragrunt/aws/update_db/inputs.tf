variable "vpc_id" {
  description = "The VPC id of the CRA UPD app"
  type        = string
}

variable "vpc_private_subnet_ids" {
  description = "List of private subnet IDs for ECS task"
  type        = list(string)
}

variable "ecr_update_db_repository_url" {
  description = "The URL of the ECR repository"
  type        = string
}

variable "docdb_endpoint" {
  description = "The DocumentDB endpoint to be used in the ECS task definition"
  type        = string
  sensitive   = true
}

variable "docdb_egress_sg_id" {
  description = "ID of the security group to allow egress to DocumentDB"
  type        = string
}

variable "data_bucket_arn" {
  description = "The ARN of the S3 data bucket"
  type        = string
}

variable "data_bucket_name" {
  description = "The name of the S3 data bucket"
  type        = string
}

variable "container_secrets" {
  description = "The secrets and associated ARNs to be used in the ECS task definition"
  type = list(object({
    name      = string
    valueFrom = string
  }))
}

variable "update_db_ecs_cpu" {
  description = "The CPU units to be used in the ECS task definition"
  type        = number
  default     = 4096
}

variable "update_db_ecs_memory" {
  description = "The memory (in MiB) to be used in the ECS task definition"
  type        = number
  default     = 8192
}

variable "schedule_cron_expression" {
  description = "Cron expression for scheduling the task (EST timezone)"
  type        = string
  default     = "cron(0 3 * * ? *)" # every day at 3:00 AM EST
}
