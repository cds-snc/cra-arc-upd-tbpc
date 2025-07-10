variable "apigw_endpoint_url" {
  description = "API Gateway Endpoint URL for the CRA UPD app"
  type        = string

  sensitive = true
}

variable "cloudfront_waf_allowed_ips" {
  description = "List of IP addresses to allow through the CloudFront WAF"
  type        = list(string)

  sensitive = true
}

variable "web_bucket_id" {
  description = "The ID of the web resources S3 bucket."
  type        = string
}

variable "web_bucket_arn" {
  description = "The ARN of the web resources S3 bucket."
  type        = string
}

variable "web_bucket_domain" {
  description = "The domain name of the web resources S3 bucket."
  type        = string

  sensitive = true
}