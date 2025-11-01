include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../aws//web"
}

dependencies {
  paths = ["../load_balancer", "../route53", "../s3"]
}

dependency "load_balancer" {
  config_path                             = "../load_balancer"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show", "destroy"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    ecs_loadbalancer_arn          = ""
    ecs_loadbalancer_listener_arn = ""
    ecs_loadbalancer_sg_id        = ""
    ecs_loadbalancer_egress_sg_id = ""
    ecs_loadbalancer_dns_name     = ""
  }
}

dependency "s3" {
  config_path                             = "../s3"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show", "destroy"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    web_bucket_id      = "mock_id"
    web_bucket_arn     = "mock_arn"
    web_bucket_domain  = "mock_domain"
    data_bucket_name   = "mock_id"
    data_bucket_arn    = "mock_arn"
    data_bucket_domain = "mock_domain"
  }
}

dependency "route53" {
  config_path                             = "../route53"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show", "destroy"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    cra_upd_hosted_zone_id     = "mock_id"
    cloudfront_certificate_arn = ""
  }
}

inputs = {
  cloudfront_waf_allowed_ips = split(",", get_env("CLOUDFRONT_WAF_ALLOWED_IPS"))
  web_bucket_id              = dependency.s3.outputs.web_bucket_id
  web_bucket_arn             = dependency.s3.outputs.web_bucket_arn
  web_bucket_domain          = dependency.s3.outputs.web_bucket_domain
  data_bucket_id             = dependency.s3.outputs.data_bucket_name
  data_bucket_arn            = dependency.s3.outputs.data_bucket_arn
  data_bucket_domain         = dependency.s3.outputs.data_bucket_domain
  loadbalancer_arn           = dependency.load_balancer.outputs.ecs_loadbalancer_arn
  loadbalancer_dns_name      = dependency.load_balancer.outputs.ecs_loadbalancer_dns_name
  hosted_zone_id             = dependency.route53.outputs.cra_upd_hosted_zone_id
  cloudfront_acm_cert        = dependency.route53.outputs.cloudfront_certificate_arn
}
