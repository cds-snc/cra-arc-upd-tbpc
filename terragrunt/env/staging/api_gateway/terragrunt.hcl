terraform {
  source = "../../../aws//database"
}

dependencies {
  paths = ["../network", "../ecs"]
}

dependency "network" {
  config_path                             = "../network"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    vpc_id                 = ""
    vpc_private_subnet_ids = [""]
    vpc_cidr_block         = ""
  }
}

dependency "ecs" {
  config_path                             = "../ecs"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    ecs_sg_id              = ""
    ecs_loadbalancer_sg_id = ""
    ecs_loadbalancer_arn   = ""
  }
}

inputs = {
  vpc_id                 = dependency.network.outputs.vpc_id
  vpc_private_subnet_ids = dependency.network.outputs.vpc_private_subnet_ids
  vpc_cidr_block         = dependency.network.outputs.vpc_cidr_block
  loadbalancer_arn       = dependency.ecs.outputs.ecs_loadbalancer_arn
  loadbalancer_sg_id     = dependency.ecs.outputs.ecs_loadbalancer_sg_id
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}