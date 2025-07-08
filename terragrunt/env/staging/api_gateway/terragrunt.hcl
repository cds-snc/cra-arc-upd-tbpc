terraform {
  source = "../../../aws//api_gateway"
}

dependencies {
  paths = ["../network", "../load_balancer"]
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

dependency "load_balancer" {
  config_path                             = "../load_balancer"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show", "destroy"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    ecs_loadbalancer_arn          = ""
    ecs_loadbalancer_listener_arn = ""
    ecs_loadbalancer_sg_id        = ""
    ecs_loadbalancer_egress_sg_id = ""
  }
}

inputs = {
  vpc_id                    = dependency.network.outputs.vpc_id
  vpc_private_subnet_ids    = dependency.network.outputs.vpc_private_subnet_ids
  vpc_cidr_block            = dependency.network.outputs.vpc_cidr_block
  loadbalancer_arn          = dependency.load_balancer.outputs.ecs_loadbalancer_arn
  loadbalancer_listener_arn = dependency.load_balancer.outputs.ecs_loadbalancer_listener_arn
  loadbalancer_sg_id        = dependency.load_balancer.outputs.ecs_loadbalancer_sg_id
  loadbalancer_egress_sg_id = dependency.load_balancer.outputs.ecs_loadbalancer_egress_sg_id
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}