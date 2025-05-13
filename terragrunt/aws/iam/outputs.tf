output "github_oidc_web_readwrite_role_arn" {
  description = "The ARN of the GitHub OIDC role for read-write access to the web bucket."
  value       = module.github_oidc_role.roles[local.web_readwrite_role_name].arn
}