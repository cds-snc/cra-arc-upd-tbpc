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

variable "loadbalancer_listener_arn" {
  description = "The ARN of the load balancer listener"
  type        = string
}

variable "loadbalancer_sg_id" {
  description = "The security group id of the load balancer"
  type        = string
}

variable "loadbalancer_egress_sg_id" {
  description = "The security group id that allows egress to the Application Load Balancer"
  type        = string
}

variable "ecs_instance_count" {
  description = "The number of ECS instances being run"
  type        = number
  default     = 1
}