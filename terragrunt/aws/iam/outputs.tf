output "github_oidc_codespaces_readonly_role_arn" {
  description = "The ARN of the GitHub OIDC role for Codespaces read-only access."
  value       = module.github_oidc_role.roles[local.readonly_role_name].arn
}