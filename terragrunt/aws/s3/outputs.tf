output "bucket_arn" {
  description = "The ARN of the S3 bucket."
  value       = module.s3_bucket.arn
}

output "bucket_name" {
  description = "The name of the S3 bucket."
  value       = module.s3_bucket.id # The module outputs the bucket name as 'id'
}
