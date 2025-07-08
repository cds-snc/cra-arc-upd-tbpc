output "ecs_loadbalancer_sg_id" {
  description = "Load Balancer Security Group ID for CRA UPD"
  value       = aws_security_group.cra_upd_loadbalancer_sg.id
}

output "ecs_loadbalancer_egress_sg_id" {
  description = "Load Balancer Egress Security Group ID for CRA UPD"
  value       = aws_security_group.cra_upd_loadbalancer_egress_sg.id
}

output "ecs_loadbalancer_arn" {
  description = "Load Balancer ARN for CRA UPD"
  value       = aws_lb.cra_upd_ecs_alb.arn
}

output "ecs_loadbalancer_listener_arn" {
  description = "Load Balancer Listener ARN for CRA UPD"
  value       = aws_lb_listener.cra_upd_ecs_alb_listener.arn
}

output "ecs_loadbalancer_target_group_arn" {
  description = "Load Balancer Target Group ARN for CRA UPD"
  value       = aws_lb_target_group.cra_upd_ecs_lb_target_group.arn
}