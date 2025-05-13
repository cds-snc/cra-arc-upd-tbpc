include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../aws//iam" # Point directly to the iam module
}

dependencies {
  paths = ["../s3"]
}

dependency "s3" {
  config_path                             = "../s3"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    data_bucket_arn = ""
    web_bucket_arn  = ""
  }
}

inputs = {
  data_bucket_arn = dependency.s3.outputs.data_bucket_arn
  web_bucket_arn  = dependency.s3.outputs.web_bucket_arn
  repo_name       = "cra-arc-upd-tbpc"
}