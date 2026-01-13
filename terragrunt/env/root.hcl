locals {
  vars = read_terragrunt_config("../env_vars.hcl")
  env  = read_terragrunt_config("../../common/environment.hcl")
}

# DO NOT CHANGE ANYTHING BELOW HERE UNLESS YOU KNOW WHAT YOU ARE DOING

inputs = {
  product_name              = "${local.vars.inputs.product_name}"
  account_id                = "${local.vars.inputs.account_id}"
  domain                    = "${local.vars.inputs.domain}"
  env                       = "${local.vars.inputs.env}"
  region                    = "ca-central-1"
  billing_code              = "${local.vars.inputs.cost_center_code}"
  billing_tag_value         = "${local.vars.inputs.billing_tag_value}"
  cbs_satellite_bucket_name = "cbs-satellite-${local.vars.inputs.account_id}"

  secrets         = local.env.inputs.secrets
  environment     = local.env.inputs.env # runtime environment variables (not to be confused with `env` above)
  validate_domain = local.vars.inputs.validate_domain
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite"
  contents  = file("./common/provider.tf")
}

generate "common_variables" {
  path      = "common_variables.tf"
  if_exists = "overwrite"
  contents  = file("./common/common_variables.tf")
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    encrypt             = true
    bucket              = "${local.vars.inputs.cost_center_code}-${local.vars.inputs.env}-tf"
    dynamodb_table      = "terraform-state-lock-dynamo"
    region              = "ca-central-1"
    key                 = "${path_relative_to_include()}/terraform.tfstate"
    s3_bucket_tags      = { CostCentre : local.vars.inputs.cost_center_code }
    dynamodb_table_tags = { CostCentre : local.vars.inputs.cost_center_code }
  }
}
