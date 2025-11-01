output "data_bucket_arn" {
  description = "The ARN of the S3 bucket."
  value       = module.cra_upd_data_s3_bucket.s3_bucket_arn
}

output "data_bucket_name" {
  description = "The name of the S3 data bucket."
  value       = module.cra_upd_data_s3_bucket.s3_bucket_id
}

output "data_bucket_domain" {
  description = "The domain name of the S3 data bucket."
  value       = module.cra_upd_data_s3_bucket.s3_bucket_regional_domain_name
}

output "web_bucket_id" {
  description = "The ID of the web resources S3 bucket."
  value       = aws_s3_bucket.cra_upd_web_bucket.id
}

output "web_bucket_arn" {
  description = "The ARN of the web resources S3 bucket."
  value       = aws_s3_bucket.cra_upd_web_bucket.arn
}

output "web_bucket_domain" {
  description = "The domain name of the web resources S3 bucket."
  value       = aws_s3_bucket.cra_upd_web_bucket.bucket_regional_domain_name
}
