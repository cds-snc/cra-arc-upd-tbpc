output "ecr_repository_url" {
  description = "URL of the CRA UPD ECR"
  value       = aws_ecr_repository.cra_upd_ecr.repository_url
}

output "ecr_repository_arn" {
  description = "Arn of the CRA UPD ECR"
  value       = aws_ecr_repository.cra_upd_ecr.arn
}

output "ecr_data_import_repository_url" {
  description = "URL of the CRA UPD Data Import ECR"
  value       = aws_ecr_repository.cra_upd_data_import_ecr.repository_url
}

output "ecr_data_import_repository_arn" {
  description = "Arn of the CRA UPD Data Import ECR"
  value       = aws_ecr_repository.cra_upd_data_import_ecr.arn
}
