output "ssm_secret_arns" {
  description = "The name and ARN of the SSM parameters created, formatted for use in an ECS container definition"
  value       = [for secret in aws_ssm_parameter.secrets : { name = secret.name, valueFrom = secret.arn }]
}