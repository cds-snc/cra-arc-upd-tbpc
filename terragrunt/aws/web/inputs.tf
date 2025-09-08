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

variable "loadbalancer_arn" {
  description = "The ARN of the ECS load balancer."
  type        = string
}

variable "loadbalancer_dns_name" {
  description = "The private DNS name of the ECS load balancer."
  type        = string

  sensitive = true
}

variable "hosted_zone_id" {
  description = "The ID of the Route 53 hosted zone."
  type        = string
}

variable "cloudfront_acm_cert" {
  description = "The ARN of the CloudFront ACM certificate."
  type        = string
}