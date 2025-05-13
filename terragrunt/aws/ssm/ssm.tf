resource "aws_ssm_parameter" "secrets" {
  for_each = nonsensitive(toset(keys(var.secrets)))
  name     = each.value
  value    = var.secrets[each.value]
  type     = "SecureString"
}