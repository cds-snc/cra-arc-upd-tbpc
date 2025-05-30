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

variable "elasticache_node_type" {
  description = "The instance type of the ElastiCache cluster"
  type        = string
  default     = "cache.t4g.micro"
}