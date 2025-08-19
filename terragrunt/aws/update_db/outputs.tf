output "update_db_dlq_arn" {
  value       = aws_sqs_queue.scheduler_dlq.arn
  description = "The ARN of the dead-letter queue for the update-db scheduler"
}

output "update_db_dlq_id" {
  value       = aws_sqs_queue.scheduler_dlq.id
  description = "The ID of the dead-letter queue for the update-db scheduler"
}