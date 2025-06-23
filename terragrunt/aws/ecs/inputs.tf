variable "vpc_id" {
  description = "The VPC id of the CRA UPD app"
  type        = string
}

variable "vpc_private_subnet_ids" {
  description = "The private subnet ids of the VPC"
  type        = list(any)
}

variable "vpc_cidr_block" {
  description = "The cidr block of the VPC"
  type        = string
}

variable "loadbalancer_sg_id" {
  description = "The security group id of the Application Load Balancer"
  type        = string
}

variable "loadbalancer_egress_sg_id" {
  description = "The security group id that allows egress to the Application Load Balancer"
  type        = string
}

variable "loadbalancer_target_group_arn" {
  description = "The ARN of the Application Load Balancer target group"
  type        = string
}

variable "ecr_repository_url" {
  description = "The URL of the ECR repository"
  type        = string
}

variable "docdb_endpoint" {
  description = "The DocumentDB endpoint to be used in the ECS task definition"
  type        = string
}

variable "docdb_egress_sg_id" {
  description = "ID of the security group to allow egress to DocumentDB"
  type        = string
}

variable "elasticache_endpoint" {
  description = "The ElastiCache endpoint to be used in the ECS task definition"
  type        = string
}

variable "elasticache_egress_sg_id" {
  description = "The security group id of the ElastiCache database"
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

variable "ecs_instance_count" {
  description = "The number of ECS instances to be used in the ECS cluster"
  type        = number
  default     = 1
}

variable "ecs_cpu" {
  description = "The CPU units to be used in the ECS task definition"
  type        = number
  default     = 512
}

variable "ecs_memory" {
  description = "The memory (in MiB) to be used in the ECS task definition"
  type        = number
  default     = 1024
}