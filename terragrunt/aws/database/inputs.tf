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

variable "docdb_instance_class" {
  description = "The instance class of the DocumentDB cluster"
  type        = string
  default     = "db.t4g.medium"
}

variable "docdb_instance_count" {
  description = "The number of instances in the DocumentDB cluster"
  type        = number
  default     = 1
}

variable "docdb_storage_type" {
  description = "The storage type to associate with the DB cluster."
  type        = string
  default     = "iopt1" # Use I/O-optimized storage by default, because our workload is I/O intensive
}

variable "docdb_backup_window" {
  description = "(Optional, default is `04:00-06:00`). Daily time range that backups execute (UTC time). Default is at 00:00am - 02:00am EST."
  type        = string
  default     = "04:00-06:00"
}