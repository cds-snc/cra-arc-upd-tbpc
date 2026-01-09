include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../aws//load_balancer"
}

dependencies {
  paths = ["../network"]
}

dependency "network" {
  config_path                             = "../network"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show", "destroy"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    vpc_id                 = ""
    vpc_private_subnet_ids = [""]
    vpc_cidr_block         = "10.0.0.0/16"
  }
}

dependency "route53" {
  config_path                             = "../route53"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show", "destroy"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    loadbalancer_certificate_arn = ""
  }
}

inputs = {
  vpc_id                       = dependency.network.outputs.vpc_id
  vpc_private_subnet_ids       = dependency.network.outputs.vpc_private_subnet_ids
  vpc_cidr_block               = dependency.network.outputs.vpc_cidr_block
  loadbalancer_certificate_arn = dependency.route53.outputs.loadbalancer_certificate_arn
}
