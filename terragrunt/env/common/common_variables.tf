variable "account_id" {
  description = "(Required) The account ID to perform actions on."
  type        = string
}

variable "cbs_satellite_bucket_name" {
  description = "(Required) Name of the Cloud Based Sensor S3 satellite bucket"
  type        = string
}

variable "env" {
  description = "The current running environment"
  type        = string
}

variable "product_name" {
  description = "The name of the product you are deploying."
  type        = string
}

variable "domain" {
  description = "The domain name to deploy to"
  type        = string
}

variable "region" {
  description = "The current AWS region"
  type        = string
}

variable "billing_code" {
  description = "The billing code to tag our resources with"
  type        = string
}

variable "billing_tag_value" {
  description = "The value we use to track billing"
  type        = string
}

variable "environment" {
  description = "The environment variables to use for deployment"
  type = list(object({
    name  = string
    value = string
  }))
  sensitive = true
}
variable "secrets" {
  description = "The secrets to use for deployment"
  type        = map(string)
  sensitive   = true
}