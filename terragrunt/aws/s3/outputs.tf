output "bucket_arn" {
  description = "The ARN of the S3 bucket."
  value       = module.s3_bucket.s3_bucket_arn # Updated attribute name
}

output "bucket_name" {
  description = "The name of the S3 bucket."
  value       = module.s3_bucket.s3_bucket_id # Updated attribute name
}
