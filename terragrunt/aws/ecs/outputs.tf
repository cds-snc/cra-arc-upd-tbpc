output "ecs_sg_id" {
  description = "ECS Security Group ID for CRA UPD"
  value       = aws_security_group.cra_upd_ecs_sg.id
}

output "ecs_loadbalancer_sg_id" {
  description = "Load Balancer Security Group ID for CRA UPD"
  value       = aws_security_group.cra_upd_loadbalancer_sg.id
}

output "ecs_loadbalancer_arn" {
  description = "Load Balancer ARN for CRA UPD"
  value       = aws_lb.cra_upd_ecs_alb.arn
}

output "ecs_loadbalancer_listener_arn" {
  description = "Load Balancer Listener ARN for CRA UPD"
  value       = aws_lb_listener.cra_upd_ecs_alb_listener.arn
}