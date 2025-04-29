output "bucket_arn" {
  description = "The ARN of the S3 bucket."
  value       = length(module.s3_bucket) > 0 ? module.s3_bucket[0].s3_bucket_arn : null
}

output "bucket_name" {
  description = "The name of the S3 bucket."
  value       = length(module.s3_bucket) > 0 ? module.s3_bucket[0].s3_bucket_id : null
}
