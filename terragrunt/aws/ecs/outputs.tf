output "ecs_sg_id" {
  description = "ECS Security Group ID for CRA UPD"
  value       = aws_security_group.cra_upd_ecs_sg.id
}
