include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../aws//s3_web_files"
}

dependencies {
  paths = ["../s3"]
}

dependency "s3" {
  config_path                             = "../s3"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    web_bucket_id = ""
  }
}

inputs = {
  bucket_id                = dependency.s3.outputs.web_bucket_id
  web_resources_build_path = "${get_parent_terragrunt_dir()}/../../dist/apps/upd"
}