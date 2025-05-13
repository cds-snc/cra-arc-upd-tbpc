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

variable "loadbalancer_arn" {
  description = "The ARN of the load balancer"
  type        = string
}

variable "loadbalancer_sg_id" {
  description = "The security group id of the load balancer"
  type        = string
}