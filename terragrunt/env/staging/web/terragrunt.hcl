include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../aws//web"
}

dependencies {
  paths = ["../api_gateway", "../s3"]
}

dependency "api_gateway" {
  config_path                             = "../api_gateway"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    cra_upd_apigw_endpoint_url = ""
  }
}

dependency "s3" {
  config_path                             = "../s3"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    web_bucket_id     = ""
    web_bucket_arn    = ""
    web_bucket_domain = ""
  }
}

inputs = {
  apigw_endpoint_url         = dependency.api_gateway.outputs.cra_upd_apigw_endpoint_url
  cloudfront_waf_allowed_ips = split(",", get_env("CLOUDFRONT_WAF_ALLOWED_IPS"))
  web_bucket_id              = dependency.s3.outputs.web_bucket_id
  web_bucket_arn             = dependency.s3.outputs.web_bucket_arn
  web_bucket_domain          = dependency.s3.outputs.web_bucket_domain
}