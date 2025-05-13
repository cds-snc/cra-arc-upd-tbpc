variable "data_bucket_expiration_days" {
  description = "The number of days to keep noncurrent versions of objects in the `data` S3 bucket."
  type        = number
  default     = 30
}

variable "data_bucket_noncurrent_versions" {
  description = "The number of noncurrent versions to keep in the `data` S3 bucket."
  type        = number
  default     = 14
}

variable "web_resources_build_path" {
  description = "The path to the web resources build directory."
  type        = string
}